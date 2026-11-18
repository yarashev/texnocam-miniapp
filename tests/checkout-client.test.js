import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto,randomUUID} from 'node:crypto';
const source=fs.readFileSync(new URL('../assets/checkout-payment-settings.js',import.meta.url),'utf8');
const order={items:[{id:1,quantity:1}],deliveryMethod:'address',phone:'+998900000000',address:'Test',servicePreference:'own_master'};
function fixture(prepared,{failOnce=false}={}){
  const button={disabled:false,isConnected:true,dataset:{}},frame={children:[],replaceChildren(...children){this.children=children},append(el){this.children.push(el)}},note={},hint={},total={},values=new Map(),calls=[];
  const host={querySelector:s=>s==='#paymentSubmitted'?button:s==='.paynet-frame'?frame:s==='#checkoutAmountNotice'?note:hint,querySelectorAll:()=>[total]};
  const context={window:{Telegram:{WebApp:{initData:new URLSearchParams({user:JSON.stringify({id:12345})}).toString()}}},document:{createElement:()=>({style:{},setAttribute(){}})},crypto:{subtle:webcrypto.subtle,randomUUID},TextEncoder,Uint8Array,URLSearchParams,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},fetch:async(url,options)=>{
    calls.push({url,body:options?.body?JSON.parse(options.body):null});
    if(failOnce){failOnce=false;throw Error('lost response')}
    return{ok:true,json:async()=>url==='/api/checkout'?prepared:{cardNumber:'8600000000000000',cardHolder:'Test',qrImage:''}};
  }};
  vm.runInNewContext(source,context);return {api:context.window.UzCamCheckoutPayment,host,button,frame,note,calls};
}
test('lost submit response recovery hides payment details and warns against a second payment',async()=>{
  const f=fixture({orderNumber:'TEST-1',total:100000,submitted:true,paymentStatus:'proof_submitted'});
  await f.api.load(f.host,structuredClone(order));
  assert.deepEqual(f.calls.map(c=>c.url),['/api/checkout']);assert.match(f.note.textContent,/Qayta to‘lov qilmang/);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'Saqlangan buyurtmani ko‘rish');
});
test('prepare retry reuses the saved intent and renders the server total before enabling payment',async()=>{
  const f=fixture({orderNumber:'TEST-2',total:200000,submitted:false},{failOnce:true}),input=structuredClone(order);
  await f.api.load(f.host,input);assert.equal(f.button.disabled,true);const retry=f.frame.children[1];await retry.onclick();
  assert.equal(f.calls[0].body.idempotencyKey,f.calls[1].body.idempotencyKey);assert.equal(input.total,200000);assert.equal(f.button.dataset.checkoutReady,'1');assert.equal(f.button.disabled,false);
});
