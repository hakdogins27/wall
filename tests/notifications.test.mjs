import assert from 'node:assert/strict';
import test from 'node:test';
import {createClient} from '@supabase/supabase-js';
import {isUnreadNotification,loadNotifications,parseNotificationCursor} from '../src/lib/notifications.ts';
const cursor={id:'post:00000000-0000-0000-0000-000000000001',created_at:'2026-11-15T12:00:00.000001Z'};
test('notification read markers validate persisted data before building a cursor filter',()=>{
 assert.deepEqual(parseNotificationCursor(JSON.stringify(cursor)),cursor);
 for(const value of [null,'bad','{}',JSON.stringify({...cursor,id:'bad'}),JSON.stringify({...cursor,created_at:'2026-11-15),id.gt.bad'})])assert.equal(parseNotificationCursor(value),null);
});
test('unread markers preserve database microseconds and deterministic same-time order',()=>{
 assert.equal(isUnreadNotification(cursor,null),true);assert.equal(isUnreadNotification(cursor,cursor),false);
 assert.equal(isUnreadNotification({...cursor,created_at:'2026-11-15T12:00:00.000002Z'},cursor),true);
 assert.equal(isUnreadNotification({...cursor,id:'post:00000000-0000-0000-0000-000000000002'},cursor),true);
 assert.equal(isUnreadNotification({...cursor,created_at:'2026-11-15T11:59:59.999999Z'},cursor),false);
});
test('notifications load a stable bounded list and an exact unread count since the validated marker',async()=>{
 const requests=[];const client=createClient('https://wall-test.supabase.co','public-test',{auth:{persistSession:false},global:{fetch:async(input,init)=>{
  const r=new Request(input,init);requests.push({url:new URL(r.url),method:r.method});
  return new Response(r.method==='HEAD'?null:JSON.stringify([{...cursor,post_id:cursor.id.slice(5),kind:'post',body:'A post'}]),{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-2/3'}});
 }}});
 const result=await loadNotifications(client,cursor);assert.equal(result.unread,3);assert.equal(result.items.length,1);
 const list=requests.find(r=>r.method==='GET').url.searchParams;assert.equal(list.get('limit'),'20');assert.equal(list.get('order'),'created_at.desc,id.desc');assert.equal(list.get('select'),'id,post_id,kind,body,created_at');
 const count=requests.find(r=>r.method==='HEAD').url.searchParams;assert.match(count.get('or'),/created_at.gt/);assert.ok(count.get('or').includes(cursor.id));
});
