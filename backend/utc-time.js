export function utcTimeMillis(input){
 if(input instanceof Date)return input.getTime();
 let value=String(input||'').trim().replace(' ','T');
 if(!value)return NaN;
 value=value.replace(/([+-]\d{2})$/,'$1:00').replace(/([+-]\d{2})(\d{2})$/,'$1:$2');
 if(!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))value+='Z';
 return Date.parse(value);
}
