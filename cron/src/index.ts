export interface Env {
  TARGET_URL: string
  INTERNAL_CRON_SECRET: string
}

async function processScheduled(env: Env) {
  try {
    const res = await fetch(`${env.TARGET_URL}/api/broadcasts/process-scheduled`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.INTERNAL_CRON_SECRET}` },
    })
    const body = await res.text()
    if (!res.ok) console.error(`process-scheduled failed: ${res.status} ${body}`)
    else console.log(`process-scheduled ok: ${body}`)
  } catch (err) {
    console.error('process-scheduled request failed', err)
  }
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processScheduled(env))
  },
} satisfies ExportedHandler<Env>
