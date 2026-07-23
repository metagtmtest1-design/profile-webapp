import { safeParseConfig, orderBySort, filterVisible, type Page, type Section, type SectionItem } from '../../_lib/content'

export interface Env {
  DB?: {
    prepare: (sql: string) => {
      bind: (...args: any[]) => { first: () => Promise<any>; all: () => Promise<{ results: any[] }> }
      first: () => Promise<any>
      all: () => Promise<{ results: any[] }>
    }
  }
  ENVIRONMENT?: string
}

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  const slug = (params?.slug as string) || ''
  const db = env?.DB

  if (!db) {
    return new Response(JSON.stringify({ error: 'DB not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  }

  try {
    // Fetch page
    const pageStmt = db.prepare('SELECT * FROM pages WHERE slug = ?1 AND is_published = 1 LIMIT 1')
    const page = (await pageStmt.bind(slug).first()) as Page | null

    if (!page) {
      return new Response(JSON.stringify({ error: 'Page not found', slug }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
      })
    }

    // Fetch sections for this page
    const sectionsStmt = db.prepare('SELECT * FROM sections WHERE page_id = ?1 ORDER BY sort_order ASC')
    const sectionsResult = await sectionsStmt.bind(page.id).all()
    const rawSections = sectionsResult.results as any[]

    // Filter visible and order (SQL already orders, but apply lib logic for safety)
    const visibleSections = filterVisible(rawSections)
    const orderedSections = orderBySort(visibleSections)

    // For each section, fetch items
    const sectionsWithItems: Section[] = []
    for (const sec of orderedSections) {
      const itemsStmt = db.prepare('SELECT * FROM section_items WHERE section_id = ?1 ORDER BY sort_order ASC')
      const itemsResult = await itemsStmt.bind(sec.id).all()
      const rawItems = itemsResult.results as any[]
      const visibleItems = filterVisible(rawItems)
      const orderedItems = orderBySort(visibleItems)

      sectionsWithItems.push({
        id: sec.id,
        page_id: sec.page_id,
        type: sec.type,
        heading: sec.heading,
        subheading: sec.subheading,
        sort_order: sec.sort_order,
        config: safeParseConfig(sec.config),
        is_visible: sec.is_visible,
        items: orderedItems as SectionItem[],
      })
    }

    const responseBody = {
      page: {
        id: page.id,
        slug: page.slug,
        title: page.title,
        meta_description: page.meta_description,
        sort_order: page.sort_order,
        is_published: page.is_published,
      },
      sections: sectionsWithItems,
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // 5-min cache per design doc 6.1 / 9.1 — 5-min TTL for content
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Source': 'd1',
      },
    })
  } catch (e: any) {
    const isLocalNoTable =
      e?.message?.includes('no such table') || e?.message?.includes('D1_ERROR')
    // Fallback for local dev when Miniflare D1 empty (pages dev persistence quirk) — return seed same as 0002_seed.sql
    // Remote will have real D1 via --remote migrations, so fallback only for local
    if (isLocalNoTable && slug === 'home') {
      const fallback = {
        page: {
          id: 'page_home',
          slug: 'home',
          title: 'Jane Doe — Designer & Developer',
          meta_description: 'Portfolio of Jane Doe — branding, design, and development services',
          sort_order: 0,
          is_published: 1,
        },
        sections: [
          {
            id: 'sec_hero',
            page_id: 'page_home',
            type: 'hero',
            heading: 'Hi, I am Jane — Designer & Developer',
            subheading: 'Crafting brand identities and digital experiences that inspire',
            sort_order: 0,
            config: { theme: 'light' },
            is_visible: 1,
            items: [
              {
                id: 'item_hero_1',
                section_id: 'sec_hero',
                title: 'Welcome to My Portfolio',
                body: 'I help startups build memorable brands and intuitive digital products. Based in San Francisco, working globally.',
                image_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200&auto=format&fit=crop',
                link_url: '/#services',
                link_text: 'Explore Services',
                sort_order: 0,
                is_visible: 1,
              },
            ],
          },
          {
            id: 'sec_services',
            page_id: 'page_home',
            type: 'cards-grid',
            heading: 'Branding & More Services',
            subheading: 'What I can do for you',
            sort_order: 1,
            config: { columns: 3 },
            is_visible: 1,
            items: [
              { id: 'item_svc_1', section_id: 'sec_services', title: 'Brand Strategy', body: 'Define your brand voice, positioning, and story', icon: '🎯', sort_order: 0, is_visible: 1 },
              { id: 'item_svc_2', section_id: 'sec_services', title: 'Logo Design', body: 'Memorable marks', icon: '✨', sort_order: 1, is_visible: 1 },
              { id: 'item_svc_3', section_id: 'sec_services', title: 'Web Design', body: 'Clean, responsive websites', icon: '💻', sort_order: 2, is_visible: 1 },
              { id: 'item_svc_4', section_id: 'sec_services', title: 'Illustration', body: 'Custom illustrations', icon: '🎨', sort_order: 3, is_visible: 1 },
              { id: 'item_svc_5', section_id: 'sec_services', title: 'Art Direction', body: 'Creative direction', icon: '📸', sort_order: 4, is_visible: 1 },
              { id: 'item_svc_6', section_id: 'sec_services', title: 'Consulting', body: '1:1 sessions', icon: '💡', sort_order: 5, is_visible: 1 },
            ],
          },
          {
            id: 'sec_about',
            page_id: 'page_home',
            type: 'text-block',
            heading: 'About Me',
            subheading: 'Passion for design, 10 years experience',
            sort_order: 2,
            config: { image_position: 'left' },
            is_visible: 1,
            items: [
              { id: 'item_about_1', section_id: 'sec_about', title: 'Jane Doe', body: 'I’m a brand designer and front-end developer with 10+ years experience...', image_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400', author: 'Senior Designer — 10 yrs', sort_order: 0, is_visible: 1 },
            ],
          },
          {
            id: 'sec_testimonials',
            page_id: 'page_home',
            type: 'testimonials',
            heading: 'Happy Clients Say',
            sort_order: 3,
            config: {},
            is_visible: 1,
            items: [
              { id: 'item_test_1', section_id: 'sec_testimonials', title: 'Startup Founder', body: 'Jane transformed our brand. Investors immediately got who we are.', author: 'John Smith — CEO, BaseAI', sort_order: 0, is_visible: 1 },
              { id: 'item_test_2', section_id: 'sec_testimonials', title: 'Product Lead', body: 'Best collaboration ever. She shipped our entire design system in 3 weeks.', author: 'Alice Johnson — Product, Loom', sort_order: 1, is_visible: 1 },
            ],
          },
          {
            id: 'sec_cta',
            page_id: 'page_home',
            type: 'cta-banner',
            heading: 'Ready to start your project?',
            subheading: 'Let’s talk about your ideas',
            sort_order: 4,
            config: {},
            is_visible: 1,
            items: [{ id: 'item_cta_1', section_id: 'sec_cta', title: 'Let’s build something great together', body: 'Available for new projects in Q3. Book a 30-min intro call.', link_url: '/#calendar', link_text: 'Book a Call', sort_order: 0, is_visible: 1 }],
          },
          {
            id: 'sec_gallery',
            page_id: 'page_home',
            type: 'image-gallery',
            heading: 'My Work — Selected Projects',
            sort_order: 5,
            config: { columns: 3 },
            is_visible: 1,
            items: [
              { id: 'item_gal_1', section_id: 'sec_gallery', title: 'BaseAI Brand', image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600', sort_order: 0, is_visible: 1 },
            ],
          },
        ],
      }
      return new Response(JSON.stringify(fallback), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Source': 'fallback-local-no-table',
        },
      })
    }

    return new Response(JSON.stringify({ error: 'Failed to fetch content', message: e?.message || String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
