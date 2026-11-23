import {useState,useEffect,useCallback} from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,ResponsiveContainer} from 'recharts';


  const BASE='https://sooraj-gym-app.'+'onrender.com'+'/api';
  const api=async(p,o={})=>{
    const r=await fetch(BASE+p,{...o,headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.token},body:o.body&&JSON.stringify(o.body)});

  const d=await r.json().catch(()=>({}));
  if(r.status===401&&localStorage.token){localStorage.clear();location.reload()}
  if(!r.ok)throw new Error(d.error||'Request failed');return d;
};
const useApi=p=>{const [d,s]=useState();const load=useCallback(()=>api(p).then(s).catch(()=>{}),[p]);useEffect(()=>{load()},[load]);return [d,load]};
const inr=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const dt=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const inp='w-full rounded-lg bg-ink border border-line px-3 py-2 text-zinc-100';
const btn='rounded-lg bg-leaf text-black font-semibold px-4 py-2 hover:brightness-110';
const ghost='rounded-lg border border-line px-3 py-1.5 text-sm hover:border-leaf';

const Card=({title,children,right})=><section className="rounded-xl bg-panel border border-line p-4 mb-4">{(title||right)&&<div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-head text-xl">{title}</h2>{right}</div>}{children}</section>;
const T=({h,children})=><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="text-zinc-400"><tr>{h.map(x=><th key={x} className="p-2 font-medium">{x}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
const R=({c})=><tr className="border-t border-line">{c.map((x,i)=><td key={i} className="p-2 align-middle">{x}</td>)}</tr>;
const Badge=({ok,children})=><span className={'rounded px-2 py-0.5 text-xs '+(ok?'bg-leaf/15 text-leaf':'bg-red-500/15 text-red-400')}>{children}</span>;
const Empty=({d,t})=>d&&!d.length?<p className="text-zinc-500 py-4">{t}</p>:null;
const Modal=({children,close})=><div className="fixed inset-0 z-50 bg-black/70 grid place-items-center p-4" onClick={close}><div className="w-full max-w-md max-h-[90vh] overflow-auto rounded-xl bg-panel border border-line p-5" onClick={e=>e.stopPropagation()}>{children}</div></div>;

function Form({fields,init={},onSave,label='Save'}){
  const [v,setV]=useState(init),[err,setErr]=useState('');
  const set=(k,x)=>setV(o=>({...o,[k]:x}));
  const img=f=>{if(!f)return;const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=160;c.getContext('2d').drawImage(i,0,0,160,160);set('photo',c.toDataURL('image/jpeg',.7))};i.src=URL.createObjectURL(f)};
  return <div className="grid gap-3">
    {fields.map(([k,l,t,o])=><label key={k} className="grid gap-1 text-sm text-zinc-400">{l}
      {t==='select'?<select className={inp} value={v[k]||''} onChange={e=>set(k,e.target.value)}><option value="">Select</option>{o.map(([a,b])=><option key={a} value={a}>{b}</option>)}</select>
      :t==='file'?<input type="file" accept="image/*" onChange={e=>img(e.target.files[0])}/>
      :<input className={inp} type={t||'text'} value={v[k]??''} onChange={e=>set(k,e.target.value)}/>}</label>)}
    {err&&<p className="text-red-400 text-sm">{err}</p>}
    <button className={btn} onClick={()=>onSave(v).catch(e=>setErr(e.message))}>{label}</button>
  </div>;
}

function Login({done}){
  const [e,setE]=useState(''),[p,setP]=useState(''),[err,setErr]=useState('');
  const go=async()=>{try{const d=await api('/login',{method:'POST',body:{email:e,password:p}});localStorage.token=d.token;localStorage.name=d.name;localStorage.role=d.role;done()}catch(x){setErr(x.message)}};
  return <div className="min-h-screen grid place-items-center p-4"><div className="w-full max-w-sm rounded-xl bg-panel border border-line p-6 grid gap-3">
    <h1 className="font-head text-3xl text-leaf">Gym Manager Automation</h1><p className="text-zinc-400 text-sm">Sign in to manage members, fees and reminders.</p>
    <input className={inp} placeholder="Email" value={e} onChange={x=>setE(x.target.value)}/>
    <input className={inp} type="password" placeholder="Password" value={p} onChange={x=>setP(x.target.value)} onKeyDown={x=>x.key==='Enter'&&go()}/>
    {err&&<p className="text-red-400 text-sm">{err}</p>}<button className={btn} onClick={go}>Sign in</button></div></div>;
}

const Chart=({data})=><div className="h-64"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="month" stroke="#888"/><YAxis stroke="#888"/><Tooltip contentStyle={{background:'#222625',border:'1px solid #343a37'}}/><Bar dataKey="income" fill="#3ddc84" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>;

function Dashboard(){
  const [d]=useApi('/dashboard');if(!d)return <p>Loading…</p>;
  const S=[['Total members',d.total],['Active',d.active],['Expired',d.expired],['Pending payments',`${d.pending.count} · ${inr(d.pending.amount)}`],["Today's registrations",d.today],['Check-ins today',d.checkins]];
  return <>
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">{S.map(([l,v])=><div key={l} className="rounded-xl bg-panel border border-line p-4"><div className="text-zinc-400 text-sm">{l}</div><div className="font-head text-3xl mt-1">{v}</div></div>)}</div>
    <Card title="Monthly revenue"><Chart data={d.revenue}/></Card>
  </>;
}

function Members(){
  const [q,setQ]=useState(''),[d,load]=useApi('/members?q='+encodeURIComponent(q)),[plans]=useApi('/plans'),[m,setM]=useState();
  const po=(plans||[]).map(p=>[p._id,`${p.name} (${inr(p.fees)})`]);
  const f=[['name','Name'],['mobile','Mobile number','tel'],['address','Address'],['joiningDate','Joining date','date'],['plan','Membership plan','select',po],['fees','Fees (blank = plan fees)','number'],['paid','Paid now','number'],['photo','Member photo','file']];
  const edit=f.filter(x=>!['plan','paid','joiningDate'].includes(x[0]));
  const save=async v=>{await api(m._id?'/members/'+m._id:'/members',{method:m._id?'PUT':'POST',body:v});setM();load()};
  const take=async x=>{const a=prompt(`Amount received from ${x.name} (due ${inr(x.due)})`);if(a){await api('/payments',{method:'POST',body:{member:x._id,amount:a}}).catch(e=>alert(e.message));load()}};
  return <Card title="Members" right={<button className={btn} onClick={()=>setM({})}>Add member</button>}>
    <input className={inp+' mb-3'} placeholder="Search by name or mobile" value={q} onChange={e=>setQ(e.target.value)}/>
    <T h={['Member','Mobile','Plan','Expires','Status','Due','']}>{(d||[]).map(x=><R key={x._id} c={[
      <div className="flex items-center gap-2">{x.photo?<img src={x.photo} className="w-8 h-8 rounded-full object-cover"/>:<div className="w-8 h-8 rounded-full bg-ink grid place-items-center">{x.name[0]}</div>}{x.name}</div>,
      x.mobile,x.plan?.name,dt(x.expiryDate),<Badge ok={x.status==='Active'}>{x.status}</Badge>,x.due>0?<span className="text-amber-400">{inr(x.due)}</span>:'Paid',
      <div className="flex gap-1 justify-end">{x.due>0&&<button className={ghost} onClick={()=>take(x)}>Take payment</button>}<button className={ghost} onClick={()=>setM(x)}>Edit</button><button className={ghost} onClick={async()=>{if(confirm('Delete '+x.name+'?')){await api('/members/'+x._id,{method:'DELETE'});load()}}}>Delete</button></div>]}/>)}</T>
    <Empty d={d} t="No members yet. Add your first member."/>
    {m&&<Modal close={()=>setM()}><h3 className="font-head text-xl mb-3">{m._id?'Edit member':'New member'}</h3><Form fields={m._id?edit:f} init={{...m,joiningDate:m.joiningDate?.slice(0,10)||new Date().toISOString().slice(0,10)}} onSave={save} label={m._id?'Save changes':'Register member'}/></Modal>}
  </Card>;
}

function Plans(){
  const [d,load]=useApi('/plans');
  return <Card title="Membership plans"><T h={['Plan','Months','Fees','']}>{(d||[]).map(p=><R key={p._id} c={[p.name,p.months,inr(p.fees),<button className={ghost} onClick={async()=>{await api('/plans/'+p._id,{method:'DELETE'}).catch(e=>alert(e.message));load()}}>Delete</button>]}/>)}</T>
    <h3 className="font-head text-lg mt-4 mb-2">Add a plan</h3>
    <Form key={d?.length} fields={[['name','Plan name'],['months','Duration (months)','number'],['fees','Fees','number']]} onSave={async v=>{await api('/plans',{method:'POST',body:v});load()}} label="Add plan"/></Card>;
}

function Payments(){
  const [d,load]=useApi('/payments'),[ms,loadM]=useApi('/members');
  const pend=(ms||[]).filter(x=>x.due>0);
  return <>
    <Card title="Pending payments"><T h={['Member','Mobile','Due','']}>{pend.map(x=><R key={x._id} c={[x.name,x.mobile,inr(x.due),<button className={ghost} onClick={()=>api('/remind/'+x._id,{method:'POST',body:{type:'pending'}}).then(()=>alert('Reminder sent'))}>Send reminder</button>]}/>)}</T><Empty d={ms&&pend} t="No pending payments."/></Card>
    <Card title="Record a payment"><Form key={d?.length} fields={[['member','Member','select',(ms||[]).map(x=>[x._id,`${x.name} - due ${inr(x.due)}`])],['amount','Amount','number'],['mode','Mode (Cash, UPI, Card)']]} init={{mode:'Cash'}} onSave={async v=>{await api('/payments',{method:'POST',body:v});load();loadM()}} label="Save payment"/></Card>
    <Card title="Payment history"><T h={['Date','Member','Amount','Mode']}>{(d||[]).map(p=><R key={p._id} c={[dt(p.date),p.member?.name,inr(p.amount),p.mode]}/>)}</T><Empty d={d} t="No payments recorded."/></Card>
  </>;
}

function Attendance(){
  const [d,load]=useApi('/attendance'),[ms]=useApi('/members');
  return <><Card title="Check in a member"><Form fields={[['member','Member','select',(ms||[]).map(x=>[x._id,`${x.name} - ${x.mobile}`])]]} onSave={async v=>{await api('/attendance',{method:'POST',body:v});load()}} label="Check in"/></Card>
    <Card title="Today's check-ins"><T h={['Time','Member','Mobile']}>{(d||[]).map(a=><R key={a._id} c={[new Date(a.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),a.member?.name,a.member?.mobile]}/>)}</T><Empty d={d} t="Nobody has checked in yet today."/></Card></>;
}

function Expiry(){
  const [d,load]=useApi('/expiry');
  const act=(u,b)=>api(u,{method:'POST',body:b}).then(load).catch(e=>alert(e.message));
  return <Card title="Expired and expiring in 7 days"><T h={['Member','Mobile','Expiry','Status','']}>{(d||[]).map(x=><R key={x._id} c={[x.name,x.mobile,dt(x.expiryDate),<Badge ok={x.status==='Active'}>{x.status}</Badge>,
    <div className="flex gap-1 justify-end"><button className={ghost} onClick={()=>act('/remind/'+x._id,{type:'expiry'})}>Remind</button><button className={ghost} onClick={()=>confirm('Renew for another plan period?')&&act(`/members/${x._id}/renew`,{})}>Renew</button></div>]}/>)}</T><Empty d={d} t="No memberships are expiring soon."/></Card>;
}

function Whatsapp(){
  const [d]=useApi('/whatsapp');
  return <Card title="WhatsApp message log"><p className="text-zinc-400 text-sm mb-3">Welcome, payment, fee and expiry messages are sent automatically. "Simulated" means no WhatsApp credentials are saved in Settings yet.</p>
    <T h={['Sent','Member','Type','Status','Message']}>{(d||[]).map(l=><R key={l._id} c={[dt(l.createdAt),l.member?.name,l.type,<Badge ok={l.status!=='failed'}>{l.status}</Badge>,<span className="text-zinc-400 whitespace-pre-wrap block max-w-xs">{l.message}</span>]}/>)}</T><Empty d={d} t="No messages yet."/></Card>;
}

function Reports(){
  const [d]=useApi('/reports');
  return <Card title="Monthly income and members" right={<button className={ghost} onClick={()=>window.print()}>Print / save PDF</button>}><Chart data={d||[]}/>
    <T h={['Month','Income','New members']}>{(d||[]).map(x=><R key={x.month} c={[x.month,inr(x.income),x.joined]}/>)}</T></Card>;
}

function Staff(){
  const [d,load]=useApi('/staff');
  return <Card title="Admin and staff accounts"><T h={['Name','Email','Role','']}>{(d||[]).map(u=><R key={u._id} c={[u.name,u.email,u.role,<button className={ghost} onClick={async()=>{await api('/staff/'+u._id,{method:'DELETE'}).catch(e=>alert(e.message));load()}}>Delete</button>]}/>)}</T>
    <h3 className="font-head text-lg mt-4 mb-2">Add an account</h3>
    <Form key={d?.length} fields={[['name','Name'],['email','Email','email'],['password','Password','password'],['role','Role','select',[['staff','Staff'],['admin','Admin']]]]} onSave={async v=>{await api('/staff',{method:'POST',body:v});load()}} label="Create account"/></Card>;
}

function Settings(){
  const [s]=useApi('/settings'),[ok,setOk]=useState(false);if(!s)return <p>Loading…</p>;
  return <Card title="Settings"><Form fields={[['gymName','Gym name'],['waPhoneId','WhatsApp phone number ID'],['waToken','WhatsApp access token','password']]} init={s} label="Save settings" onSave={async v=>{await api('/settings',{method:'PUT',body:v});setOk(true)}}/>{ok&&<p className="text-leaf text-sm mt-2">Settings saved.</p>}</Card>;
}

const PAGES={Dashboard,Members,Memberships:Plans,Payments,WhatsApp:Whatsapp,Attendance,Expiry,Reports,Staff,Settings};
const ADMIN=['Staff','Settings','Memberships'];

export default function App(){
  const [on,setOn]=useState(!!localStorage.token);
  return on?<Shell out={()=>{localStorage.clear();setOn(false)}}/>:<Login done={()=>setOn(true)}/>;
}
function Shell({out}){
  const [page,setPage]=useState('Dashboard'),[nav,setNav]=useState(false),[bell,setBell]=useState(false),[d]=useApi('/dashboard');
  const P=PAGES[page],items=Object.keys(PAGES).filter(k=>localStorage.role==='admin'||!ADMIN.includes(k));
  return <div className="min-h-screen lg:flex">
    <aside className={'fixed inset-y-0 left-0 z-40 w-56 bg-panel border-r border-line p-4 transition-transform lg:static lg:translate-x-0 '+(nav?'':'-translate-x-full')}>
      <div className="font-head text-2xl text-leaf mb-6">Gym Manager</div>
      <nav className="grid gap-1">{items.map(k=><button key={k} onClick={()=>{setPage(k);setNav(false)}} className={'text-left rounded-lg px-3 py-2 '+(k===page?'bg-leaf text-black font-semibold':'hover:bg-ink')}>{k}</button>)}</nav>
    </aside>
    <main className="flex-1 min-w-0">
      <header className="sticky top-0 z-30 bg-ink/90 backdrop-blur border-b border-line px-4 py-3 flex items-center gap-3">
        <button className={ghost+' lg:hidden'} onClick={()=>setNav(!nav)}>Menu</button>
        <h1 className="font-head text-2xl flex-1">{page}</h1>
        <div className="relative"><button className={ghost} onClick={()=>setBell(!bell)}>Alerts{d?.alerts?.length?` (${d.alerts.length})`:''}</button>
          {bell&&<div className="absolute right-0 mt-2 w-72 rounded-xl bg-panel border border-line p-3 text-sm grid gap-2">{d?.alerts?.length?d.alerts.map((a,i)=><div key={i}>{a}</div>):<span className="text-zinc-400">Nothing needs attention.</span>}</div>}</div>
        <button className={ghost} onClick={out}>Sign out</button>
      </header>
      <div className="p-4 max-w-6xl"><P/></div>
    </main>
  </div>;
}
