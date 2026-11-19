export function createTelegramClient(token,{fetcher=fetch,timeoutMs=10000}={}){
  let retryAt=0;
  const send=async(method,payload)=>{
    if(!token)throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    if(!/^[A-Za-z]+$/.test(method))throw new Error('Telegram method is invalid');
    let response,result;
    try{response=await fetcher('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeoutMs)});result=await response.json();}
    catch{throw new Error('Telegram API '+method+' request did not complete');}
    if(!response.ok||!result.ok){
      const code=Number(result.error_code||response.status),retryAfter=Number(result.parameters?.retry_after);
      if(code===429&&Number.isFinite(retryAfter)&&retryAfter>0)retryAt=Date.now()+retryAfter*1000;
      throw Object.assign(new Error('Telegram API '+method+' failed ('+code+')'),{telegramCode:code,retryAfter:Number.isFinite(retryAfter)&&retryAfter>0?retryAfter:null,telegramAlreadyApplied:code===400&&/message is not modified|message to edit not found/i.test(String(result.description||''))});
    }
    return result.result;
  };send.retryAt=()=>retryAt;return send;
}
