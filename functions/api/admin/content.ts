import { requireAdminAuth, isAdminAuthenticated } from '../../_lib/auth'
import { getEnvironment } from '../../_lib/env'

export interface Env {
  DB: any
  ENVIRONMENT?: string
  ADMIN_BYPASS?: string
  ADMIN_EMAILS?: string
  [key: string]: any
}

function parseConfigSafe(configRaw: string | null): any {
  if (!configRaw) return {}
  try {
    return JSON.parse(configRaw)
  } catch {
    return {}
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const commonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  }

  const authFailure = requireAdminAuth(request, env)
  if (authFailure) {
    console.log(`!!! ADMIN_CONTENT_AUTH_FAILED status=${authFailure.status}`)
    return authFailure
  }

  const authResult = isAdminAuthenticated(request, env)
  const envName = getEnvironment(env as any)
  console.log(`!!! ADMIN_CONTENT_REQUEST env=${envName} email=${authResult.email} bypass=${authResult.bypass}`)

  const db = env?.DB
  if (!db) {
    return new Response(JSON.stringify({ error: 'DB binding missing' }), { status: 500, headers: commonHeaders })
  }

  try {
    // Get home page - for admin we want all pages? Simplify to home page for portfolio
    const pageStmt = db.prepare('SELECT * FROM pages WHERE slug = ? AND is_published = 1').bind('home')
    const page = await pageStmt.first()
    if (!page) {
      return new Response(JSON.stringify({ error: 'Page not found: home' }), { status: 404, headers: commonHeaders })
    }

    // Admin view: include all sections even if is_visible=0, ordered by sort_order (for editing)
    const sectionsStmt = db.prepare('SELECT * FROM sections WHERE page_id = ? ORDER BY sort_order ASC').bind(page.id)
    const sectionsResult = await sectionsStmt.all()
    const sections = sectionsResult.results || []

    // For each section, get all items including hidden, ordered
    const sectionsWithItems = []
    for (const sec of sections) {
      const itemsStmt = db.prepare('SELECT * FROM section_items WHERE section_id = ? ORDER BY sort_order ASC').bind(sec.id)
      const itemsResult = await itemsStmt.all()
      const items = itemsResult.results || []
      sectionsWithItems.push({
        ...sec,
        config: parseConfigSafe(sec.config),
        items,
      })
    }

    console.log(`!!! ADMIN_CONTENT_SUCCESS sections=${sectionsWithItems.length} env=${envName}`)

    return new Response(
      JSON.stringify({
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          meta_description: page.meta_description,
        },
        sections: sectionsWithItems,
        meta: {
          env: envName,
          email: authResult.email,
          bypass: !!authResult.bypass,
          totalSections: sectionsWithItems.length,
        },
      }),
      {
        status: 200,
        headers: commonHeaders,
      }
    )
  } catch (e: any) {
    console.log(`!!! ADMIN_CONTENT_ERROR ${e?.message}`)
    return new Response(JSON.stringify({ error: `Failed to fetch admin content: ${e?.message || String(e)}` }), {
      status: 500,
      headers: commonHeaders,
    })
  }
}
