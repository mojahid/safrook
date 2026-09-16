import { getDatabase } from "@netlify/database";

export async function getState(){
 const db=getDatabase();
 const rows=await db.sql`SELECT payload FROM app_state WHERE id = ${"safrook"}`;
 return {db,state:rows[0]?.payload||{}};
}
export async function putState(db,state){
 await db.sql`
  INSERT INTO app_state (id,payload,updated_at)
  VALUES (${"safrook"},${JSON.stringify(state)}::jsonb,NOW())
  ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()
 `;
}
