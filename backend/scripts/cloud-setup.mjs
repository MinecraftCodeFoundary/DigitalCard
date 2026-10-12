import { collections } from '../../cloudfunctions/digitalCard/repository.mjs'
import { cloudClient, checked } from './cloud-client.mjs'
const db = cloudClient().database()
for (const name of collections) {
  try { checked(await db.createCollection(name)); console.log(`已创建 ${name}`) }
  catch (error) {
    if (!/already exist|ResourceExist|COLLECTION_EXIST/i.test(error.message)) throw error
    console.log(`已存在 ${name}`)
  }
}
console.log('请在云控制台为所有集合应用 cloudfunctions/database.rules.json，并配置索引，详见 docs/CloudDevelopment.md')
