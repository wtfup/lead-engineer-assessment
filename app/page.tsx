'use client';
import {useEffect,useRef,useState} from 'react';
type Summary={tenant:string;paidOrders:number;netRevenuePaise:number;adSpendPaise:number;roas:number|null};
type Order={id:string;tenant:string;campaignId:string;amountPaise:number;status:string};
type LoadStatus='idle'|'loading'|'ready'|'error';
const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
export default function Page(){
 const [tenant,setTenant]=useState('north');
 const [summary,setSummary]=useState<Summary|null>(null);
 const [orders,setOrders]=useState<Order[]>([]);
 const [dataTenant,setDataTenant]=useState<string|null>(null);
 const [status,setStatus]=useState<LoadStatus>('idle');
 const [notice,setNotice]=useState('');
 const [selected,setSelected]=useState<unknown>(null);
 const [working,setWorking]=useState(false);
 const requestId=useRef(0);
 async function load(scope:string){
  const id=++requestId.current;
  setStatus('loading');
  try{
   const headers={'x-lab-tenant':scope};
   const [s,o]=await Promise.all([fetch('/api/summary',{headers,cache:'no-store'}),fetch('/api/orders',{headers,cache:'no-store'})]);
   if(!s.ok||!o.ok)throw new Error('Service unavailable. Check the API terminal.');
   const [summaryBody,ordersBody]=[await s.json(),await o.json()];
   if(requestId.current!==id) return; // a newer request superseded this one; drop the stale response
   setSummary(summaryBody);
   setOrders(ordersBody.items);
   setDataTenant(scope);
   setStatus('ready');
  }catch(e){
   if(requestId.current!==id) return;
   setNotice(e instanceof Error?e.message:'Unable to load');
   setStatus('error');
  }
 }
 useEffect(()=>{setSelected(null);void load(tenant)},[tenant]);
 async function inspect(id:string){const r=await fetch('/api/orders/'+encodeURIComponent(id),{headers:{'x-lab-tenant':tenant}});setSelected(await r.json())}
 async function processJobs(){
  if(working) return; // avoid accidental double-submission; the server remains the source of truth for idempotency
  setWorking(true);
  setNotice('Processing local simulator only…');
  try{
   const r=await fetch('/api/jobs/process',{method:'POST',headers:{'x-lab-tenant':tenant,'content-type':'application/json'},body:'{}'});
   const body=await r.json();
   setNotice(r.ok?JSON.stringify(body):(body.error||'Worker request failed.'));
   await load(tenant);
  }catch{
   setNotice('Worker request failed. Inspect the API log before retrying.');
  }finally{
   setWorking(false);
  }
 }
 const stale=dataTenant!==null && dataTenant!==tenant;
 const showingSummary=status==='ready' && !stale ? summary : null;
 const showingOrders=status==='ready' && !stale ? orders : [];
 return <main><div className="ribbon">ASSESSMENT LAB · SYNTHETIC DATA · NO REAL PAYMENTS OR MESSAGES</div><header><div className="brand">N<span>↗</span></div><div><p className="eyebrow">NORTHSTAR / OPERATIONS</p><h1>Recovery desk</h1></div><div className="scope"><label htmlFor="tenant">Lab account</label><select id="tenant" value={tenant} onChange={e=>setTenant(e.target.value)}><option value="north">North</option><option value="south">South</option></select></div></header>
 <section className="intro"><div><p className="eyebrow">YOUR MISSION</p><h2>Make the numbers trustworthy.<br/>Make recovery safe.</h2><p>The starter runs, but business behaviour is intentionally incomplete. Read the candidate brief before treating any displayed metric as fact.</p></div><div className="lab"><span className="dot"/> LOCAL SIMULATOR<span>API → PostgreSQL → Worker → UI</span><strong>No provider credentials required.</strong></div></section>
 <div className="section-head"><h2>Account overview <small data-testid="selected-tenant">{tenant}</small></h2><button onClick={()=>void load(tenant)} disabled={status==='loading'}>{status==='loading'?'Loading…':'Refresh data'}</button></div>
 <div className="notice" role="status" data-testid="load-status">
  {status==='loading'||stale?`Loading ${tenant} account…`:status==='error'?(notice||'Unable to load this account.'):(notice||'Investigate ledger evidence before recommending budget or workflow changes.')}
 </div>
 <section className="metrics" aria-label="Account metrics" aria-busy={status==='loading'||stale} data-testid="metrics" data-state={stale||status==='loading'?'stale':status}>
  <article><p>Paid orders</p><strong data-testid="paid-orders">{showingSummary?showingSummary.paidOrders:'—'}</strong></article>
  <article><p>Net revenue</p><strong data-testid="net-revenue">{showingSummary?money(showingSummary.netRevenuePaise):'—'}</strong></article>
  <article><p>Ad spend</p><strong>{showingSummary?money(showingSummary.adSpendPaise):'—'}</strong></article>
  <article><p>Revenue / ad spend</p><strong>{!showingSummary||!Number.isFinite(showingSummary.roas)?'—':showingSummary.roas.toFixed(2)+'×'}</strong></article>
 </section>
 <section className="panel"><div className="section-head"><div><h2>Order queue</h2><p>Inspect a record, reconcile its history, and test safe recovery.</p></div><button className="primary" onClick={()=>void processJobs()} disabled={working} aria-busy={working}>{working?'Processing…':'Run lab worker'}</button></div><div className="table-wrap"><table><thead><tr><th>Order</th><th>Campaign</th><th>Value</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{showingOrders.map(o=><tr key={o.id}><td><code>{o.id}</code></td><td>{o.campaignId}</td><td>{money(o.amountPaise)}</td><td><span className={'badge '+o.status}>{o.status}</span></td><td><button className="text" onClick={()=>void inspect(o.id)}>Inspect →</button></td></tr>)}</tbody></table>{status==='loading'||stale?<p className="empty" data-testid="orders-loading">Loading orders for {tenant}…</p>:status==='error'?<p className="empty" data-testid="orders-error">{notice||'Could not load orders.'}</p>:!showingOrders.length&&<p className="empty" data-testid="orders-empty">No orders returned for this account.</p>}</div></section>
 {selected!==null&&<section className="panel"><div className="section-head"><h2>Record inspection</h2><button onClick={()=>setSelected(null)}>Close</button></div><pre>{JSON.stringify(selected,null,2)}</pre></section>}
 <footer>Northstar is a fictional company. Lab identity headers are a test convenience—not production authentication. <a href="https://github.com/wtfup/lead-engineer-assessment">Assessment instructions ↗</a></footer></main>
}
