require('dotenv').config();
const express=require('express'),mongoose=require('mongoose'),jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs'),cors=require('cors'),cron=require('node-cron');
const {Schema,model}=mongoose,Id=Schema.Types.ObjectId,ref=r=>({type:Id,ref:r});
const User=model('User',new Schema({name:String,email:{type:String,unique:true},password:String,role:{type:String,default:'staff'}}));
const Plan=model('Plan',new Schema({name:String,months:Number,fees:Number}));
const Member=model('Member',new Schema({name:{type:String,required:true},mobile:{type:String,required:true},address:String,photo:String,plan:ref('Plan'),joiningDate:Date,expiryDate:Date,fees:Number,paid:{type:Number,default:0},lastReminder:Date},{timestamps:true}));
const Payment=model('Payment',new Schema({member:ref('Member'),amount:Number,mode:String,date:{type:Date,default:Date.now}}));
const Attendance=model('Attendance',new Schema({member:ref('Member'),day:String,time:{type:Date,default:Date.now}}));
const WaLog=model('WaLog',new Schema({member:ref('Member'),type:String,message:String,status:String},{timestamps:true}));
const Setting=model('Setting',new Schema({gymName:{type:String,default:'Sooraj Deshwal Fitness Gym'},waToken:String,waPhoneId:String,waEnabled:{type:Boolean,default:true}}));

const gym=()=>Setting.findOne().then(s=>s||Setting.create({}));
const addM=(d,n)=>{d=new Date(d);d.setMonth(d.getMonth()+n);return d};
const fmt=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'});
const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
const view=m=>{const o=m.toObject();return{...o,status:o.expiryDate<new Date()?'Expired':'Active',due:o.fees-o.paid}};
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const msg=(t,m,s,x)=>({
 welcome:`Hello ${m.name} 👋\nWelcome to ${s.gymName}! 🏋️\nYour membership has been successfully registered.\n\nMembership: ${x}\nJoining Date: ${fmt(m.joiningDate)}\nFees: ${inr(m.fees)}\n\nThank you for joining us. Stay fit, stay healthy! 💪`,
 pending:`Hello ${m.name},\nThis is a friendly reminder from ${s.gymName} that your membership payment of ${inr(m.fees-m.paid)} is currently pending.\nPlease contact the gym to confirm your payment. Thank you!`,
 expiry:`Hello ${m.name}! Your gym membership is approaching its expiry date (${fmt(m.expiryDate)}). Please contact us for renewal details. Thank you for being a member! 💪`,
 paid:`Hello ${m.name}, we received your payment of ${inr(x)}. Thank you! ✅ - ${s.gymName}`}[t]);

// WhatsApp Business Cloud API. Without token + phone ID, messages are only logged as "simulated".
async function wa(m,type,text){
 const s=await gym();let status='simulated';
 if(s.waEnabled&&s.waToken&&s.waPhoneId){
  const to=m.mobile.replace(/\D/g,'').replace(/^(\d{10})$/,'91$1');
  try{const r=await fetch(`https://graph.facebook.com/v20.0/${s.waPhoneId}/messages`,{method:'POST',headers:{Authorization:'Bearer '+s.waToken,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to,type:'text',text:{body:text}})});status=r.ok?'sent':'failed'}catch{status='failed'}
 }
 await WaLog.create({member:m._id,type,message:text,status});
}
async function pay(m,amount,mode){
 m.paid+=amount;await m.save();await Payment.create({member:m._id,amount,mode});
 await wa(m,'payment',msg('paid',m,await gym(),amount));
}
const monthly=async()=>{
 const g=c=>[{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$'+c}},n:{$sum:c==='date'?'$amount':1}}}];
 const o={};
 (await Payment.aggregate(g('date'))).forEach(x=>o[x._id]={month:x._id,income:x.n,joined:0});
 (await Member.aggregate(g('joiningDate'))).forEach(x=>(o[x._id]??={month:x._id,income:0,joined:0}).joined=x.n);
 return Object.values(o).sort((a,b)=>a.month<b.month?-1:1);
};

const app=express();app.use(cors(),express.json({limit:'2mb'}));
const A=f=>(q,r,n)=>f(q,r,n).catch(e=>r.status(400).json({error:e.message}));
const auth=(q,r,n)=>{try{q.user=jwt.verify((q.headers.authorization||'').slice(7),process.env.JWT_SECRET||'dev');n()}catch{r.status(401).json({error:'Please log in'})}};
const admin=(q,r,n)=>q.user.role==='admin'?n():r.status(403).json({error:'Admin only'});

app.post('/api/login',A(async(q,r)=>{
 const u=await User.findOne({email:q.body.email});
 if(!u||!await bcrypt.compare(q.body.password||'',u.password))throw new Error('Wrong email or password');
 r.json({token:jwt.sign({id:u.id,role:u.role,name:u.name},process.env.JWT_SECRET||'dev',{expiresIn:'7d'}),name:u.name,role:u.role});
}));
const api=express.Router();app.use('/api',auth,api);

api.get('/dashboard',A(async(q,r)=>{
 const all=(await Member.find()).map(view),t=new Date();t.setHours(0,0,0,0);
 const pend=all.filter(m=>m.due>0),soon=all.filter(m=>m.status==='Active'&&m.expiryDate-Date.now()<7*864e5);
 r.json({total:all.length,active:all.filter(m=>m.status==='Active').length,expired:all.filter(m=>m.status==='Expired').length,
  pending:{count:pend.length,amount:pend.reduce((a,m)=>a+m.due,0)},today:all.filter(m=>m.createdAt>=t).length,
  checkins:await Attendance.countDocuments({day:new Date().toISOString().slice(0,10)}),revenue:await monthly(),
  alerts:[...soon.map(m=>`${m.name} expires on ${fmt(m.expiryDate)}`),...pend.slice(0,5).map(m=>`${m.name} owes ${inr(m.due)}`)]});
}));
api.get('/reports',A(async(q,r)=>r.json(await monthly())));

api.get('/members',A(async(q,r)=>{
 const s=q.query.q?new RegExp(esc(q.query.q),'i'):null;
 const l=await Member.find(s?{$or:[{name:s},{mobile:s}]}:{}).populate('plan').sort('-createdAt');
 r.json(l.map(view));
}));
api.post('/members',A(async(q,r)=>{
 const b=q.body,p=await Plan.findById(b.plan||null);if(!p)throw new Error('Choose a membership plan');
 const j=new Date(b.joiningDate||Date.now());
 const m=await Member.create({name:b.name,mobile:b.mobile,address:b.address,photo:b.photo,plan:p.id,joiningDate:j,expiryDate:addM(j,p.months),fees:Number(b.fees||p.fees)});
 await wa(m,'welcome',msg('welcome',m,await gym(),p.name));
 if(+b.paid>0)await pay(m,+b.paid,'Cash');
 r.json(view(m));
}));
api.put('/members/:id',A(async(q,r)=>{
 const{name,mobile,address,photo,fees}=q.body;
 r.json(view(await Member.findByIdAndUpdate(q.params.id,{name,mobile,address,photo,fees},{new:true,runValidators:true})));
}));
api.delete('/members/:id',A(async(q,r)=>{await Member.findByIdAndDelete(q.params.id);r.json({ok:1})}));
api.post('/members/:id/renew',A(async(q,r)=>{
 const m=await Member.findById(q.params.id),p=await Plan.findById(q.body.plan||m.plan);
 m.plan=p.id;m.expiryDate=addM(m.expiryDate>new Date()?m.expiryDate:new Date(),p.months);m.fees+=p.fees;await m.save();r.json(view(m));
}));
api.post('/remind/:id',A(async(q,r)=>{
 const m=await Member.findById(q.params.id),t=q.body.type==='expiry'?'expiry':'pending';
 await wa(m,t,msg(t,m,await gym()));r.json({ok:1});
}));
api.get('/expiry',A(async(q,r)=>r.json((await Member.find({expiryDate:{$lt:new Date(Date.now()+7*864e5)}}).sort('expiryDate')).map(view))));

api.get('/plans',A(async(q,r)=>r.json(await Plan.find().sort('months'))));
api.post('/plans',admin,A(async(q,r)=>r.json(await Plan.create(q.body))));
api.delete('/plans/:id',admin,A(async(q,r)=>{await Plan.findByIdAndDelete(q.params.id);r.json({ok:1})}));

api.get('/payments',A(async(q,r)=>r.json(await Payment.find().populate('member','name').sort('-date').limit(200))));
api.post('/payments',A(async(q,r)=>{
 const m=await Member.findById(q.body.member||null),a=+q.body.amount;
 if(!m||!(a>0))throw new Error('Choose a member and enter an amount');
 await pay(m,a,q.body.mode||'Cash');r.json({ok:1});
}));

api.get('/attendance',A(async(q,r)=>r.json(await Attendance.find({day:q.query.day||new Date().toISOString().slice(0,10)}).populate('member','name mobile').sort('-time'))));
api.post('/attendance',A(async(q,r)=>{
 const m=await Member.findById(q.body.member||null),day=new Date().toISOString().slice(0,10);
 if(!m)throw new Error('Choose a member');
 if(m.expiryDate<new Date())throw new Error('Membership expired - renew first');
 if(await Attendance.exists({member:m._id,day}))throw new Error('Already checked in today');
 r.json(await Attendance.create({member:m._id,day}));
}));

api.get('/whatsapp',A(async(q,r)=>r.json(await WaLog.find().populate('member','name').sort('-createdAt').limit(200))));

api.get('/staff',admin,A(async(q,r)=>r.json(await User.find({},'-password'))));
api.post('/staff',admin,A(async(q,r)=>{
 const{name,email,password,role}=q.body;if(!password||password.length<6)throw new Error('Password needs 6+ characters');
 await User.create({name,email,role:role||'staff',password:await bcrypt.hash(password,10)});r.json({ok:1});
}));
api.delete('/staff/:id',admin,A(async(q,r)=>{if(q.params.id===q.user.id)throw new Error("You can't delete yourself");await User.findByIdAndDelete(q.params.id);r.json({ok:1})}));
api.get('/settings',admin,A(async(q,r)=>r.json(await gym())));
api.put('/settings',admin,A(async(q,r)=>{const s=await gym();Object.assign(s,q.body);await s.save();r.json(s)}));

// Daily 9am: expiry (within 3 days) and pending-fee reminders, at most once per 3 days per member
cron.schedule('0 9 * * *',async()=>{
 const s=await gym();
 for(const m of await Member.find()){
  const d=(m.expiryDate-Date.now())/864e5,t=d<=3&&d>-30?'expiry':view(m).due>0?'pending':null;
  if(t&&(!m.lastReminder||Date.now()-m.lastReminder>3*864e5)){await wa(m,t,msg(t,m,s));m.lastReminder=new Date();await m.save()}
 }
});

mongoose.connect(process.env.MONGO_URI||'mongodb://127.0.0.1:27017/gym').then(async()=>{
 if(!await User.countDocuments())await User.create({name:'Admin',email:process.env.ADMIN_EMAIL||'admin@gym.com',password:await bcrypt.hash(process.env.ADMIN_PASSWORD||'admin123',10),role:'admin'});
 if(!await Plan.countDocuments())await Plan.insertMany([{name:'Monthly',months:1,fees:1000},{name:'3 Months',months:3,fees:2700},{name:'6 Months',months:6,fees:5000},{name:'Yearly',months:12,fees:9000}]);
 await gym();app.listen(process.env.PORT||5000,()=>console.log('API running'));
});
