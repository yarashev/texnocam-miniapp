export function startBackgroundRunner(tasks,{intervalMs=15000,onError=()=>{}}={}){
  let current=null,requested=false,stopping=false;
  const state={running:false,lastStartedAt:null,lastFinishedAt:null,lastError:null};
  const shouldStop=()=>stopping;
  function tick(wake=false){
    if(stopping)return Promise.resolve();
    if(current){if(wake)requested=true;return current;}
    current=(async()=>{
      do{
        requested=false;state.running=true;state.lastStartedAt=new Date().toISOString();
        for(const [name,task] of tasks){if(stopping)break;try{await task({shouldStop});}catch{state.lastError=name+' failed';onError(name);}}
        state.lastFinishedAt=new Date().toISOString();
      }while(requested&&!stopping);
    })().finally(()=>{state.running=false;current=null;});return current;
  }
  const timer=setInterval(()=>void tick(),intervalMs);timer.unref?.();
  return {wake:()=>tick(true),start:()=>tick(),status:()=>({...state}),async stop(){stopping=true;clearInterval(timer);if(current)await current;}};
}
