import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const contentTypes={png:'image/png',jpg:'image/jpeg',webp:'image/webp'};

export function createImageStorage(database, env = process.env, fetcher = fetch) {
  const directory=path.join(env.UZCAM_DATA_DIR?path.resolve(env.UZCAM_DATA_DIR):path.resolve('.data'),'uploads');
  const configured=Boolean(env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY);
  const bucket=env.SUPABASE_STORAGE_BUCKET || 'product-images';
  function storageConfig() {
    if(!configured) return null;
    if(!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase Storage URL va server kalitini birga sozlang');
    const base=new URL(env.SUPABASE_URL);
    if(base.protocol!=='https:' || base.username || base.password || !/^[a-z0-9-]+$/.test(bucket)) throw new Error('Supabase Storage sozlamalari noto‘g‘ri');
    return {base:base.origin,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}};
  }
  return {
    mode:()=>configured?'supabase-storage':database.kind==='postgres'?'postgres':'local',
    async initialize() {
      const config=storageConfig();
      if(!config) return;
      const response=await fetcher(config.base+'/storage/v1/bucket/'+bucket,{headers:config.headers,signal:AbortSignal.timeout(15000)});
      if(!response.ok) throw new Error('Supabase Storage omboriga ulanib bo‘lmadi');
      const info=await response.json();
      if(info.public!==true) throw new Error('Mahsulot rasmlari uchun ombor public bo‘lishi kerak');
    },
    async save(bytes,ext) {
      if(!contentTypes[ext] || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length>3145728) throw new Error('Rasm formati yoki hajmi noto‘g‘ri');
      const name=randomUUID()+'.'+ext, config=storageConfig();
      if(config) {
        const response=await fetcher(config.base+'/storage/v1/object/'+bucket+'/'+name,{method:'POST',headers:{...config.headers,'Content-Type':contentTypes[ext],'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(30000)});
        if(!response.ok) throw new Error('Supabase Storage rasmni saqlay olmadi');
        return config.base+'/storage/v1/object/public/'+bucket+'/'+name;
      }
      if(database.kind==='postgres') {
        await database.run('INSERT INTO product_image_files(name,content_type,bytes) VALUES (?,?,?)',name,contentTypes[ext],bytes);
      } else {
        await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,name),bytes,{flag:'wx'});
      }
      return 'uploads/'+name;
    },
    async load(name) {
      if(!/^[a-f0-9-]+\.(png|jpg|webp)$/.test(name)) return null;
      if(database.kind==='postgres') {
        const image=await database.get('SELECT content_type,bytes FROM product_image_files WHERE name=?',name);
        return image?{contentType:image.content_type,bytes:Buffer.from(image.bytes)}:null;
      }
      try {return {contentType:contentTypes[path.extname(name).slice(1)],bytes:await fs.readFile(path.join(directory,name))};}
      catch(error){if(error.code==='ENOENT')return null;throw error;}
    }
  };
}
