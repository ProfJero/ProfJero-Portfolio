// Rich studio page content. Merged over the base studio records (id, name, icon, color, tagline, description, url, services).
export const STUDIO_DETAILS = {
  "digital-studio": {
    headline: "Smart Systems, Real Impact",
    intro: "ProfJero Digital Studio designs and builds websites, web apps, mobile apps and business systems that solve real problems for schools, shops, churches, NGOs and growing companies. Every project is led directly by Benjamin Amoako (ProfJero), a full-stack developer and IT trainer with five years of hands-on experience, so you work with the person who actually writes your code. We build for the Ghanaian reality: mobile-first, data-light, Mobile Money ready and easy for your team to use.",
    mode: "Mostly remote",
    seoTitle: "ProfJero Digital Studio | Web & Software Developer in Ghana",
    seoDescription: "Websites, web apps, mobile apps, POS, school and inventory systems built in Cape Coast, Ghana. Firebase and Cloudflare hosting, IT training and support.",
    keywords: "web developer Ghana, software developer Cape Coast, website design Ghana, mobile app developer Ghana, school management system Ghana, POS system Ghana, inventory system, Firebase developer, Cloudflare Pages, IT training Ghana, ProfJero",
    services: [
      {
        title: "Business & Personal Websites",
        text: "Fast, mobile-first websites that present your business clearly, rank on Google and turn visitors into WhatsApp chats, calls and bookings.",
        icon: "fa-solid fa-globe",
        features: ["Responsive design for phones, tablets and desktops", "On-page SEO and Google Business Profile setup", "WhatsApp, call and contact form integration", "Free SSL and fast hosting on Cloudflare"],
        duration: "1–4 weeks",
        mode: "remote"
      },
      {
        title: "Custom Web Applications",
        text: "Browser-based applications built around how your organisation really works, from booking portals and client dashboards to membership and records systems.",
        icon: "fa-solid fa-laptop-code",
        features: ["User accounts with roles and permissions", "Real-time data with Firebase or a SQL backend", "Paystack / Mobile Money payment integration", "Admin panel your staff can manage without code"],
        duration: "4–12 weeks",
        mode: "remote"
      },
      {
        title: "Business Management Systems",
        text: "Point-of-sale, inventory, school management and church/membership systems that replace notebooks and spreadsheets with reliable, searchable records.",
        icon: "fa-solid fa-cash-register",
        features: ["Sales, stock and expense tracking", "Student records, fees, results and report cards", "Printable receipts, invoices and reports", "Works on low-cost laptops, tablets and phones"],
        duration: "4–10 weeks",
        mode: "hybrid"
      },
      {
        title: "Dashboards & Admin Portals",
        text: "Clear dashboards that pull your data together so owners and managers can see sales, attendance, stock or performance at a glance.",
        icon: "fa-solid fa-chart-line",
        features: ["Charts and KPIs that update automatically", "Export to Excel / PDF", "Secure login for managers and staff", "Connects to existing forms, sheets or databases"],
        duration: "2–6 weeks",
        mode: "remote"
      },
      {
        title: "Mobile App Development",
        text: "Cross-platform Android and iOS apps, or installable progressive web apps (PWAs) that work offline and cost less to build and maintain.",
        icon: "fa-solid fa-mobile-screen-button",
        features: ["Android-first with optional iOS build", "Offline support for areas with weak network", "Push notifications", "Play Store publishing assistance"],
        duration: "6–14 weeks",
        mode: "remote"
      },
      {
        title: "Cloud, Backend & Hosting",
        text: "Secure, affordable infrastructure on Firebase, Cloudflare and similar platforms, including domains, business email, databases, APIs and backups.",
        icon: "fa-solid fa-cloud",
        features: ["Domain, DNS and business email setup", "Firebase Auth, Firestore and Storage", "Cloudflare Pages, Workers and security rules", "Backups, monitoring and maintenance plans"],
        duration: "1–3 weeks",
        mode: "remote"
      },
      {
        title: "AI-Assisted Automation & Integrations",
        text: "Practical use of AI and automation to save staff time: chat assistants for FAQs, automated reports, form-to-database workflows and connections between the tools you already use.",
        icon: "fa-solid fa-robot",
        features: ["Website chat assistant trained on your FAQs", "Automated email / WhatsApp notifications", "Google Workspace and spreadsheet automation", "API integrations between existing systems"],
        duration: "1–6 weeks",
        mode: "remote"
      },
      {
        title: "IT Training & Digital Skills",
        text: "Hands-on training for individuals, staff teams and schools, from computer basics and Microsoft Office to web development and using your new system confidently.",
        icon: "fa-solid fa-chalkboard-user",
        features: ["Staff onboarding for systems we build", "Web development and coding bootcamps", "Office productivity and digital literacy", "In-person in Cape Coast or live online"],
        duration: "1 day – 12 weeks",
        mode: "hybrid"
      }
    ],
    highlights: [
      { icon: "fa-solid fa-user-check", title: "Work Directly With the Developer", text: "No middlemen. The person who scopes your project is the person who builds and supports it." },
      { icon: "fa-solid fa-mobile-screen", title: "Built for Ghana", text: "Mobile-first, data-light designs with Mobile Money, WhatsApp and SMS integrations where they make sense." },
      { icon: "fa-solid fa-graduation-cap", title: "Training Included", text: "As an IT trainer, ProfJero makes sure your team can actually use and manage what we deliver." },
      { icon: "fa-solid fa-file-contract", title: "Clear Scope & Ownership", text: "Written quotes, milestone payments, and full ownership of your domain, content and code at handover." }
    ],
    process: [
      { title: "Discovery Call", text: "A free 30-minute call or WhatsApp chat to understand your goals, users, budget and timeline." },
      { title: "Proposal & Quote", text: "You receive a written scope, timeline and fixed quote with clear milestones before any work starts." },
      { title: "Design & Prototype", text: "We share mockups or a clickable prototype so you can see and approve the experience early." },
      { title: "Build & Review", text: "Development in short cycles with a live preview link, so you can test and give feedback as it grows." },
      { title: "Launch, Training & Support", text: "We deploy, train your team and stay available for fixes, updates and maintenance after launch." }
    ],
    packages: [
      {
        name: "Starter Website",
        tagline: "For individuals, freelancers and small businesses getting online",
        prefix: "From",
        price: "GH₵ 4,500",
        priceUsd: "$450",
        period: "one-off",
        features: ["Up to 5 pages, mobile-friendly", "WhatsApp and contact form integration", "Basic on-page SEO and Google Business Profile", "Free hosting setup on Cloudflare Pages", "1 month of free support after launch"],
        featured: false
      },
      {
        name: "Business Website",
        tagline: "For established businesses, schools and organisations",
        prefix: "From",
        price: "GH₵ 9,500",
        priceUsd: "$950",
        period: "one-off",
        features: ["Up to 12 pages with custom design", "Content management or admin panel", "Booking, enquiry or product catalogue features", "Domain, business email and analytics setup", "Staff training session", "3 months of free support"],
        featured: true
      },
      {
        name: "Business System",
        tagline: "Custom web app: POS, inventory, school or records system",
        prefix: "From",
        price: "GH₵ 22,000",
        priceUsd: "$2,200",
        period: "one-off",
        features: ["Requirements workshop and system design", "User roles, dashboards and reports", "Cloud database with backups", "Payment or SMS integration where needed", "On-site or online staff training", "3 months of support, then optional maintenance plan"],
        featured: false
      }
    ],
    faqs: [
      { q: "How much does a website cost in Ghana?", a: "Our starter websites begin from GH₵ 4,500 and business websites from GH₵ 9,500. The final price depends on the number of pages, features and content needed. You always get a written quote before work begins." },
      { q: "How long will my project take?", a: "A starter website typically takes 1–3 weeks, a business website 3–6 weeks, and a custom business system 6–12 weeks. Timelines depend on how quickly content and feedback are provided." },
      { q: "Do I need to be in Cape Coast to work with you?", a: "No. Most digital projects are handled remotely through calls, WhatsApp and live preview links. For system rollouts and staff training we can also visit your premises in Cape Coast and nearby areas, or train online." },
      { q: "How do payments work?", a: "We usually work with a deposit to start, followed by milestone payments, with the balance due at launch. Mobile Money and bank transfer are accepted." },
      { q: "Will I own my website and code?", a: "Yes. Once the project is fully paid, your domain, content and the code built for you are yours. We set up accounts in your name wherever possible." },
      { q: "What happens after launch?", a: "Every package includes a free support period. After that, you can choose an optional monthly maintenance plan for updates, backups, security checks and small changes, or request help as needed." }
    ],
    cta: { title: "Have a system or website in mind?", text: "Tell us what you want to build. We will reply with honest advice, a clear scope and a starting quote, usually within one working day." }
  },

  "creative-studio": {
    headline: "Your Brand, On Everything",
    intro: "ProfJero Creative Studio puts your logo, name and message on the products people actually keep: watches, wall clocks, mugs, power banks, T-shirts, trophies, frames and more. We handle the design, mockup and production so your corporate gifts, events, school celebrations, church programmes, weddings and memorials look polished and personal. Need a logo first? We design brand identities too.",
    mode: "Hybrid",
    seoTitle: "ProfJero Creative Studio | Product Branding in Cape Coast",
    seoDescription: "Custom-branded watches, clocks, mugs, T-shirts, trophies, frames and corporate gifts in Cape Coast, Ghana. Design, UV printing, engraving and delivery.",
    keywords: "product branding Ghana, branded watches Ghana, custom wall clocks, corporate gifts Ghana, branded mugs, T-shirt printing Cape Coast, trophies and medals Ghana, plaques, banner printing, roll-up banners, sticker printing, logo design Ghana, ProfJero Creative",
    services: [
      {
        title: "Custom Timepieces",
        text: "Wristwatches and wall clocks with your logo printed on the dial or engraved on the case back. A lasting gift for staff, clients, anniversaries and memorials.",
        icon: "fa-solid fa-clock",
        features: ["Full-colour dial printing", "Laser engraving on case backs", "Gift boxes with branded sleeves", "Wall clocks for offices, schools and churches"],
        duration: "5–10 days",
        mode: "hybrid"
      },
      {
        title: "Tech Accessory Branding",
        text: "Phone covers, power banks, USB drives and keyholders branded for promotions, conferences and staff welcome packs.",
        icon: "fa-solid fa-mobile-screen",
        features: ["UV printing on phone covers and power banks", "Engraved or printed USB drives", "Metal, leather and acrylic keyholders", "Single custom pieces or bulk orders"],
        duration: "3–7 days",
        mode: "hybrid"
      },
      {
        title: "Drinkware & Gift Items",
        text: "Mugs, magic mugs, flasks and water bottles printed or engraved with logos, photos and messages for gifts, events and everyday branding.",
        icon: "fa-solid fa-mug-hot",
        features: ["Sublimation printing on ceramic mugs", "Laser-engraved stainless bottles and flasks", "Photo and name personalisation", "Gift wrapping available"],
        duration: "2–5 days",
        mode: "hybrid"
      },
      {
        title: "Apparel & Textile Printing",
        text: "T-shirts, polo shirts, caps and tote bags for staff uniforms, events, campaigns, church anniversaries, funerals and weddings.",
        icon: "fa-solid fa-shirt",
        features: ["DTF, vinyl and screen printing", "Embroidery options for polos and caps", "Sizes from kids to XXXL", "Bulk pricing for events and groups"],
        duration: "3–10 days",
        mode: "hybrid"
      },
      {
        title: "Awards & Recognition",
        text: "Trophies, medals and plaques for schools, sports, churches and corporate awards nights, engraved with names, titles and dates.",
        icon: "fa-solid fa-trophy",
        features: ["Acrylic, crystal-look, wood and metal awards", "Custom-printed medals and ribbons", "Engraved name plates and plaques", "Speech and prize-giving day packages"],
        duration: "4–10 days",
        mode: "hybrid"
      },
      {
        title: "Print & Signage",
        text: "Banners, roll-ups, stickers, flyers and backdrops that help your business or event get noticed.",
        icon: "fa-solid fa-print",
        features: ["Flex banners and roll-up stands", "Vinyl, die-cut and label stickers", "Event backdrops and photo walls", "Flyers, posters and programme booklets"],
        duration: "1–5 days",
        mode: "hybrid"
      },
      {
        title: "Frames, Décor & Stationery",
        text: "Picture frames, branded notebooks, pens and diaries for gifts, office use, memorials and keepsakes.",
        icon: "fa-solid fa-image",
        features: ["Modern and classic photo frames", "Engraved or printed frame plaques", "Branded notebooks, diaries and pens", "Memorial and wedding keepsakes"],
        duration: "3–7 days",
        mode: "hybrid"
      },
      {
        title: "Logo & Brand Identity Design",
        text: "A logo and simple brand kit that looks great on screen and on every product we brand for you, plus packaging and label design.",
        icon: "fa-solid fa-pen-nib",
        features: ["Logo concepts and revisions", "Colour palette and font guide", "Print-ready and social media files", "Packaging and label design"],
        duration: "5–14 days",
        mode: "remote"
      }
    ],
    highlights: [
      { icon: "fa-solid fa-eye", title: "See It Before We Make It", text: "You approve a digital mockup of every product before production starts, so there are no surprises." },
      { icon: "fa-solid fa-layer-group", title: "Design to Delivery in One Place", text: "Logo design, artwork preparation, printing, engraving and packaging handled by one team." },
      { icon: "fa-solid fa-boxes-stacked", title: "Small or Bulk Orders", text: "From a single personalised gift to hundreds of branded items for a conference or anniversary." },
      { icon: "fa-solid fa-calendar-check", title: "Event-Ready Timelines", text: "Clear lead times agreed upfront so your items arrive before the programme, launch or ceremony." }
    ],
    process: [
      { title: "Share Your Brief", text: "Tell us the products, quantities, event date and send your logo or idea via WhatsApp or the quote form." },
      { title: "Quote & Mockup", text: "We send a quote and digital mockups showing exactly how your branding will look on each item." },
      { title: "Approve & Deposit", text: "Approve the design and pay a deposit by Mobile Money or bank transfer to start production." },
      { title: "Production & Quality Check", text: "Items are printed, engraved or embroidered, then checked one by one for quality." },
      { title: "Pick-Up or Delivery", text: "Collect in Cape Coast or have your order delivered anywhere in Ghana by courier or bus service." }
    ],
    packages: [
      {
        name: "Starter Branding Bundle",
        tagline: "For new businesses and small teams",
        prefix: "From",
        price: "GH₵ 1,500",
        priceUsd: "$140",
        period: "one-off",
        features: ["Simple logo design or logo clean-up", "10 branded T-shirts", "10 branded mugs", "100 vinyl logo stickers", "Digital mockups before printing"],
        featured: false
      },
      {
        name: "Corporate Gift Pack",
        tagline: "Staff, client and end-of-year gifts",
        prefix: "From",
        price: "GH₵ 4,500",
        priceUsd: "$420",
        period: "for 20 packs",
        features: ["20 gift packs in branded boxes", "Each pack: branded watch or bottle, notebook, pen and keyholder", "Optional name personalisation", "Gift tags with your message", "Delivery within Cape Coast included"],
        featured: true
      },
      {
        name: "Event Package",
        tagline: "Launches, anniversaries, weddings, funerals and programmes",
        prefix: "From",
        price: "GH₵ 3,000",
        priceUsd: "$280",
        period: "per event",
        features: ["1 roll-up banner and 1 flex banner", "30 printed T-shirts or souvenir items", "Programme or brochure design", "Branded stickers or labels", "Production timed to your event date"],
        featured: false
      }
    ],
    faqs: [
      { q: "What is the minimum order quantity?", a: "Many items, such as watches, mugs, frames and phone covers, can be made as a single personalised piece. Some items, like printed pens, stickers and caps, have small minimums. Each product in our catalogue shows its minimum quantity." },
      { q: "How long does production take?", a: "Most orders are ready in 3–10 working days after design approval and deposit, depending on the product and quantity. Tell us your event date upfront and we will confirm whether it can be met." },
      { q: "Do I need to have a logo already?", a: "No. We can design a logo for you or clean up an existing one so it prints sharply. A clear PNG, PDF or vector file gives the best results if you already have one." },
      { q: "Will I see the design before you produce it?", a: "Yes. We send a digital mockup for every order, and production only starts after you approve it." },
      { q: "Do you deliver outside Cape Coast?", a: "Yes. Orders can be collected in Cape Coast or sent anywhere in Ghana through courier or bus parcel services. Delivery costs depend on location and package size." },
      { q: "How do I pay?", a: "We accept Mobile Money and bank transfer. Orders usually require a deposit to begin production, with the balance paid before pick-up or delivery." }
    ],
    cta: { title: "Ready to put your brand on something people keep?", text: "Pick products from our catalogue or describe your idea. We will send a quote and mockup, usually within one working day." }
  },

  "agro-studio": {
    headline: "Cultivating Excellence, Harvesting Success",
    intro: "ProfJero Agro Studio brings practical technology and sound farm management to Ghanaian farmers, from smallholders to growing commercial farms. We combine on-farm visits with digital tools such as soil and moisture sensors, irrigation automation and simple farm record apps, so you can make better decisions with less guesswork. We also train farmers and young people who want to start or grow an agribusiness.",
    mode: "Mostly in-person",
    seoTitle: "ProfJero Agro Studio | Smart Farming & Agri-Tech in Ghana",
    seoDescription: "Smart farming, irrigation automation, soil health advice, farm record apps and agribusiness training for farmers in Cape Coast and the Central Region of Ghana.",
    keywords: "smart farming Ghana, agri-tech Ghana, irrigation automation, soil testing Central Region, farm management app, poultry advisory Ghana, farm consulting Cape Coast, agribusiness training, farm records, ProfJero Agro",
    services: [
      {
        title: "Smart Farming & IoT Sensors",
        text: "Soil moisture, temperature and humidity sensors that send readings to your phone, helping you water and manage crops based on data rather than guesswork.",
        icon: "fa-solid fa-microchip",
        features: ["Soil moisture and weather monitoring", "Readings on a simple phone dashboard", "Alerts for dry soil or extreme heat", "Solar-powered options for remote plots"],
        duration: "1–3 weeks",
        mode: "in-person"
      },
      {
        title: "Irrigation Design & Automation",
        text: "Drip and sprinkler irrigation planning, with optional timers or sensor-based controllers that save water, fuel and labour.",
        icon: "fa-solid fa-droplet",
        features: ["Site survey and water source assessment", "Drip or sprinkler layout design", "Timer and sensor-controlled valves", "Setup support and farmer training"],
        duration: "1–4 weeks",
        mode: "in-person"
      },
      {
        title: "Crop Consulting & Soil Health",
        text: "Field visits to assess your soil, crops and practices, with practical recommendations on soil fertility, planting, spacing and pest and disease management.",
        icon: "fa-solid fa-seedling",
        features: ["Soil sampling and referral to accredited labs", "Fertiliser and organic matter recommendations", "Integrated pest management advice", "Written visit report with action plan"],
        duration: "1–2 weeks per visit cycle",
        mode: "hybrid"
      },
      {
        title: "Farm Management Records & Apps",
        text: "Simple digital systems to track inputs, labour, sales, livestock and costs so you know what is profitable and can present proper records to buyers or lenders.",
        icon: "fa-solid fa-clipboard-list",
        features: ["Input, expense and sales tracking", "Livestock and flock records", "Season and profit reports", "Works on a basic Android phone"],
        duration: "2–6 weeks",
        mode: "hybrid"
      },
      {
        title: "Poultry & Livestock Advisory",
        text: "Practical guidance on housing, feeding, biosecurity, record keeping and production planning for poultry, goats, sheep and pigs, working alongside veterinary professionals for animal health.",
        icon: "fa-solid fa-egg",
        features: ["Pen and housing layout advice", "Feeding and production schedules", "Biosecurity checklists", "Referral to licensed vets for health issues"],
        duration: "Ongoing or per visit",
        mode: "hybrid"
      },
      {
        title: "Farm-to-Market Digital Presence",
        text: "Help farms and agribusinesses reach buyers directly with a simple website, WhatsApp catalogue, product labels and social media setup.",
        icon: "fa-solid fa-store",
        features: ["WhatsApp Business catalogue setup", "Simple farm website or product page", "Product photos and label design", "Order and delivery workflow"],
        duration: "1–3 weeks",
        mode: "remote"
      },
      {
        title: "Farmer & Youth Agribusiness Training",
        text: "Hands-on workshops for farmer groups, cooperatives, schools and young people on modern farming practices, record keeping and using technology in agriculture.",
        icon: "fa-solid fa-users",
        features: ["Smart farming and irrigation basics", "Farm record keeping and costing", "Agribusiness planning and marketing", "Delivered in English or Fante/Twi support"],
        duration: "1 day – 6 weeks",
        mode: "in-person"
      }
    ],
    highlights: [
      { icon: "fa-solid fa-tractor", title: "Practical, On-Farm Advice", text: "We visit your farm and recommend changes that fit your land, budget and labour, not generic textbook answers." },
      { icon: "fa-solid fa-microchip", title: "Technology That Fits", text: "Affordable sensors, phone apps and automation chosen for local conditions, power and network coverage." },
      { icon: "fa-solid fa-chart-column", title: "Records That Pay Off", text: "Better records help you track profit, plan seasons and present your farm professionally to buyers and lenders." },
      { icon: "fa-solid fa-handshake", title: "Partnering With Experts", text: "We work alongside accredited soil labs, extension officers and licensed vets where specialist input is needed." }
    ],
    process: [
      { title: "Initial Conversation", text: "Tell us about your farm, crops or animals, location and challenges by phone or WhatsApp." },
      { title: "Farm Visit & Assessment", text: "We visit the site to assess soil, water, layout, practices and existing records." },
      { title: "Recommendations & Quote", text: "You receive a practical action plan with costed options, from quick wins to longer-term upgrades." },
      { title: "Implementation", text: "We install equipment, set up records or apps and train you and your workers on site." },
      { title: "Follow-Up & Remote Advisory", text: "Ongoing check-ins by phone, WhatsApp or follow-up visits to review results through the season." }
    ],
    packages: [
      {
        name: "Farm Assessment Visit",
        tagline: "A clear starting point for your farm",
        prefix: "From",
        price: "GH₵ 800",
        priceUsd: "$75",
        period: "per visit",
        features: ["On-site visit within Cape Coast area", "Soil, water and practice assessment", "Soil sample collection for lab referral", "Written report with action plan", "Transport outside Cape Coast quoted separately"],
        featured: false
      },
      {
        name: "Smart Farm Starter Kit",
        tagline: "Sensor monitoring and basic irrigation automation",
        prefix: "From",
        price: "GH₵ 6,500",
        priceUsd: "$600",
        period: "one-off",
        features: ["Soil moisture and weather sensors", "Phone dashboard and alerts", "Timer or sensor-controlled irrigation valve", "Installation and training", "3 months of remote support"],
        featured: true
      },
      {
        name: "Seasonal Advisory Plan",
        tagline: "Ongoing guidance through the growing season",
        prefix: "From",
        price: "GH₵ 1,200",
        priceUsd: "$110",
        period: "/month",
        features: ["Monthly farm visit", "Unlimited WhatsApp advisory", "Digital farm records setup", "Seasonal planning and review", "Minimum 3-month commitment"],
        featured: false
      }
    ],
    faqs: [
      { q: "Which areas do you cover for farm visits?", a: "We regularly visit farms in Cape Coast and the wider Central Region. Visits further away are possible, with transport and accommodation costs quoted in advance. Remote advisory is available anywhere in Ghana." },
      { q: "Is smart farming technology affordable for small farmers?", a: "It can be. We start with the simplest tools that solve your biggest problem, such as a single moisture sensor or an irrigation timer, and only recommend upgrades when they make financial sense." },
      { q: "Do the sensors need internet?", a: "Most setups use mobile data through a small SIM-based gateway or Wi-Fi. Where coverage is weak, we can use devices that store readings locally and sync when a connection is available." },
      { q: "Do you do soil testing yourselves?", a: "We collect samples and send them to accredited soil laboratories, then interpret the results and turn them into practical fertiliser and soil-management recommendations for you." },
      { q: "Can you treat sick animals?", a: "No. We provide management and production advice for poultry and livestock. For diagnosis and treatment we refer you to a licensed veterinarian." },
      { q: "Do you train groups and schools?", a: "Yes. We run workshops for farmer groups, cooperatives, schools, churches and youth programmes. Content and duration are tailored to the group." }
    ],
    cta: { title: "Ready to farm smarter?", text: "Book a farm assessment or ask a question on WhatsApp. We will help you find the most practical next step for your farm." }
  },

  "nourish-studio": {
    headline: "Wholesome Nourishment, Healthy Living",
    intro: "ProfJero Nourish Studio helps individuals, families, workplaces and communities eat better with practical, evidence-based nutrition guidance built around Ghanaian foods and everyday budgets. From personal meal plans and healthy meal prep to workplace wellness programmes and nutrition talks for schools and churches, we make healthy eating simple and sustainable. Our guidance supports, and never replaces, care from your doctor.",
    mode: "Hybrid",
    seoTitle: "ProfJero Nourish Studio | Nutrition & Wellness in Ghana",
    seoDescription: "Evidence-based nutrition guidance, meal plans with Ghanaian foods, healthy meal prep and workplace wellness programmes in Cape Coast and online across Ghana.",
    keywords: "nutrition consultant Ghana, meal planning Ghana, healthy Ghanaian meals, workplace wellness Ghana, meal prep Cape Coast, nutrition education schools, healthy eating Ghana, wellness programme, ProfJero Nourish",
    services: [
      {
        title: "Personal Nutrition Consultation",
        text: "A one-on-one session to review your eating habits, goals and lifestyle, followed by practical recommendations you can start using straight away.",
        icon: "fa-solid fa-user-doctor",
        features: ["Eating habits and lifestyle review", "Realistic goal setting", "Practical food swaps using local foods", "In person or by video call"],
        duration: "60–90 minutes",
        mode: "hybrid"
      },
      {
        title: "Personalised Meal Plans",
        text: "Weekly meal plans built around Ghanaian staples, your schedule, budget and preferences, with shopping lists and simple recipes.",
        icon: "fa-solid fa-utensils",
        features: ["Plans based on familiar local foods", "Weekly shopping lists", "Portion guidance", "Options for busy professionals and students"],
        duration: "1–4 weeks",
        mode: "remote"
      },
      {
        title: "Family Nutrition Coaching",
        text: "Guidance for parents and households on balanced family meals, children's lunch boxes and feeding the whole family well on a budget.",
        icon: "fa-solid fa-people-roof",
        features: ["Family meal planning", "Healthy lunch box ideas", "Budget-friendly shopping tips", "Follow-up check-ins"],
        duration: "4–8 weeks",
        mode: "hybrid"
      },
      {
        title: "Workplace Wellness Programmes",
        text: "Talks, workshops and challenges that help staff build healthier eating and lifestyle habits, delivered at your workplace or online.",
        icon: "fa-solid fa-briefcase",
        features: ["Lunchtime nutrition talks", "Healthy eating challenges", "Canteen and snack recommendations", "Wellness resources for staff"],
        duration: "1 day – 3 months",
        mode: "hybrid"
      },
      {
        title: "Healthy Meal Prep & Food Products",
        text: "Freshly prepared balanced meals and healthy snack options for individuals, offices and events in the Cape Coast area.",
        icon: "fa-solid fa-bowl-food",
        features: ["Weekly balanced meal packs", "Office lunch and event catering", "Healthy snacks and drinks", "Clear ingredient information"],
        duration: "Weekly or per order",
        mode: "in-person"
      },
      {
        title: "Nutrition Education for Schools & Churches",
        text: "Engaging, age-appropriate nutrition talks and workshops for students, parents, youth groups and congregations.",
        icon: "fa-solid fa-school",
        features: ["Talks for students and PTAs", "Church and community health days", "Printable handouts and posters", "Cooking demonstrations on request"],
        duration: "1–3 hours per session",
        mode: "in-person"
      }
    ],
    highlights: [
      { icon: "fa-solid fa-book-open", title: "Evidence-Based Guidance", text: "Advice grounded in recognised nutrition guidelines, explained in plain, practical language." },
      { icon: "fa-solid fa-wheat-awn", title: "Built Around Local Foods", text: "Kenkey, banku, kontomire, beans, fish and fruits: healthy eating with the foods you already know and can afford." },
      { icon: "fa-solid fa-scale-balanced", title: "Realistic, Not Extreme", text: "No crash diets or miracle products. Small, sustainable changes that fit real life." },
      { icon: "fa-solid fa-user-doctor", title: "Works With Your Doctor", text: "We support medical care, never replace it, and refer you to a doctor for any medical condition." }
    ],
    process: [
      { title: "Book a Session", text: "Reach out by phone, WhatsApp or the booking form to choose a consultation, programme or meal prep order." },
      { title: "Understand Your Needs", text: "We discuss your goals, routine, food preferences, budget and any advice you have from your doctor." },
      { title: "Your Plan", text: "You receive a practical meal plan, programme outline or menu tailored to you, your family or your team." },
      { title: "Support & Follow-Up", text: "Regular check-ins help you stay on track and adjust the plan as your needs change." }
    ],
    packages: [
      {
        name: "Nutrition Starter",
        tagline: "One consultation and a practical plan to get going",
        prefix: "From",
        price: "GH₵ 350",
        priceUsd: "$35",
        period: "one-off",
        features: ["60-minute consultation (in person or online)", "1-week meal plan with local foods", "Shopping list", "1 follow-up WhatsApp check-in"],
        featured: false
      },
      {
        name: "Healthy Habits Programme",
        tagline: "Four weeks of guided support",
        prefix: "From",
        price: "GH₵ 1,200",
        priceUsd: "$110",
        period: "4 weeks",
        features: ["Initial consultation", "4 weekly meal plans and shopping lists", "Weekly progress check-ins", "Recipe and meal prep guide", "WhatsApp support during the programme"],
        featured: true
      },
      {
        name: "Workplace Wellness",
        tagline: "For offices, schools and organisations",
        prefix: "From",
        price: "GH₵ 2,500",
        priceUsd: "$230",
        period: "per session",
        features: ["On-site or online nutrition talk", "Q&A for staff", "Printable wellness resources", "Healthy snack and canteen tips", "Multi-session programmes available"],
        featured: false
      }
    ],
    faqs: [
      { q: "Can you help me manage a medical condition like diabetes or hypertension?", a: "We can share general healthy-eating guidance, but we do not diagnose or treat medical conditions. If you have a medical condition, please see your doctor first, and we will gladly work alongside the advice they give you." },
      { q: "Do your meal plans use Ghanaian foods?", a: "Yes. Our plans are built around familiar, affordable local foods, with portion and preparation tips that make everyday meals more balanced." },
      { q: "Can I do consultations online?", a: "Yes. Consultations, meal plans and follow-ups can be done by video call and WhatsApp anywhere in Ghana or abroad. Meal prep and in-person workshops are available in the Cape Coast area." },
      { q: "Do you sell weight-loss supplements or detox products?", a: "No. We focus on food, habits and lifestyle. We do not promote miracle products or extreme diets." },
      { q: "Do you cater for events and offices?", a: "Yes. We prepare healthy meal packs and light catering for offices, meetings and small events in and around Cape Coast. Please order a few days in advance." },
      { q: "How much does a workplace programme cost?", a: "A single on-site nutrition talk starts from GH₵ 2,500. Multi-session programmes are quoted based on staff numbers, location and the activities you choose." }
    ],
    cta: { title: "Start eating better this week", text: "Book a consultation, order healthy meal packs or invite us to your workplace, school or church." }
  }
};

// Product branding catalogue for the Creative Studio (clients request quotes for these).
export const PRODUCTS = [
  { id: "branded-wristwatch", name: "Branded Wristwatch", category: "Timepieces", description: "Quartz wristwatch with your logo printed on the dial and optional engraved case back. A popular gift for staff awards, anniversaries and memorials.", methods: ["Dial printing", "Laser engraving"], minQty: 1, priceFrom: "GH₵ 180", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-clock", featured: true, order: 1 },
  { id: "custom-wall-clock", name: "Custom Wall Clock", category: "Timepieces", description: "Wall clock with a full-colour printed face featuring your logo, photo or message. Ideal for offices, classrooms, churches and memorial keepsakes.", methods: ["UV printing", "Sublimation printing"], minQty: 1, priceFrom: "GH₵ 150", unit: "per piece", leadTime: "4–7 days", icon: "fa-regular fa-clock", featured: true, order: 2 },
  { id: "branded-phone-cover", name: "Custom Phone Cover", category: "Tech Accessories", description: "Phone case printed with your logo, artwork or photo. Available for popular iPhone, Samsung, Tecno and Infinix models.", methods: ["UV printing", "Sublimation printing"], minQty: 1, priceFrom: "GH₵ 80", unit: "per piece", leadTime: "2–5 days", icon: "fa-solid fa-mobile-screen", featured: true, order: 3 },
  { id: "branded-power-bank", name: "Branded Power Bank", category: "Tech Accessories", description: "Slim power bank branded with your logo. A practical corporate gift and conference giveaway people use every day.", methods: ["UV printing", "Laser engraving"], minQty: 10, priceFrom: "GH₵ 150", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-battery-full", featured: false, order: 4 },
  { id: "branded-usb-drive", name: "Branded USB Flash Drive", category: "Tech Accessories", description: "Metal or plastic USB drives with your logo, optionally preloaded with your company profile, brochure or presentation.", methods: ["Laser engraving", "UV printing"], minQty: 10, priceFrom: "GH₵ 70", unit: "per piece", leadTime: "5–10 days", icon: "fa-brands fa-usb", featured: false, order: 5 },
  { id: "custom-keyholder", name: "Custom Keyholder", category: "Tech Accessories", description: "Metal, leather or acrylic keyholders with your logo or name. Affordable giveaways for events, estates and car dealers.", methods: ["Laser engraving", "UV printing"], minQty: 10, priceFrom: "GH₵ 25", unit: "per piece", leadTime: "3–7 days", icon: "fa-solid fa-key", featured: false, order: 6 },
  { id: "branded-mug", name: "Branded Mug", category: "Drinkware", description: "Ceramic mug printed with your logo, photo or message. Magic colour-changing mugs also available.", methods: ["Sublimation printing"], minQty: 1, priceFrom: "GH₵ 45", unit: "per piece", leadTime: "2–5 days", icon: "fa-solid fa-mug-hot", featured: true, order: 7 },
  { id: "branded-water-bottle", name: "Branded Water Bottle & Flask", category: "Drinkware", description: "Stainless steel bottles and vacuum flasks engraved or printed with your branding. Durable and eco-friendly.", methods: ["Laser engraving", "UV printing"], minQty: 1, priceFrom: "GH₵ 90", unit: "per piece", leadTime: "3–7 days", icon: "fa-solid fa-bottle-water", featured: false, order: 8 },
  { id: "printed-tshirt", name: "Printed T-Shirt", category: "Apparel", description: "Quality cotton T-shirts printed with your design for events, campaigns, church programmes, funerals and weddings.", methods: ["DTF printing", "Screen printing", "Vinyl heat press"], minQty: 1, priceFrom: "GH₵ 65", unit: "per piece", leadTime: "3–7 days", icon: "fa-solid fa-shirt", featured: true, order: 9 },
  { id: "branded-polo-shirt", name: "Branded Polo Shirt", category: "Apparel", description: "Smart polo shirts with embroidered or printed logo for staff uniforms and corporate teams.", methods: ["Embroidery", "DTF printing"], minQty: 5, priceFrom: "GH₵ 110", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-user-tie", featured: false, order: 10 },
  { id: "branded-cap", name: "Branded Cap", category: "Apparel", description: "Caps with embroidered or printed logos for teams, campaigns, outdoor events and promotions.", methods: ["Embroidery", "Vinyl heat press"], minQty: 10, priceFrom: "GH₵ 50", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-shirt", featured: false, order: 11 },
  { id: "branded-tote-bag", name: "Branded Tote Bag", category: "Apparel", description: "Reusable canvas and non-woven tote bags printed with your logo for conferences, shops and souvenirs.", methods: ["Screen printing", "DTF printing"], minQty: 10, priceFrom: "GH₵ 35", unit: "per piece", leadTime: "4–7 days", icon: "fa-solid fa-bag-shopping", featured: false, order: 12 },
  { id: "flex-banner", name: "Flex Banner", category: "Print & Signage", description: "Durable indoor and outdoor flex banners for shops, events, funerals and church programmes. Any size, with eyelets for hanging.", methods: ["Large-format printing"], minQty: 1, priceFrom: "GH₵ 35", unit: "per sq. ft", leadTime: "1–3 days", icon: "fa-solid fa-flag", featured: false, order: 13 },
  { id: "roll-up-banner", name: "Roll-Up Banner", category: "Print & Signage", description: "Portable pull-up banner with stand and carry bag. Ideal for launches, exhibitions, church events and receptions.", methods: ["Large-format printing"], minQty: 1, priceFrom: "GH₵ 450", unit: "per piece", leadTime: "2–4 days", icon: "fa-solid fa-scroll", featured: true, order: 14 },
  { id: "custom-stickers", name: "Custom Stickers & Labels", category: "Print & Signage", description: "Vinyl, die-cut and product label stickers in any shape and size, waterproof options available.", methods: ["Vinyl printing", "Die cutting"], minQty: 50, priceFrom: "GH₵ 2", unit: "per piece", leadTime: "2–4 days", icon: "fa-solid fa-note-sticky", featured: false, order: 15 },
  { id: "custom-trophy", name: "Custom Trophy", category: "Awards & Recognition", description: "Acrylic, crystal-look and metal trophies engraved with names, titles and dates for schools, sports and awards nights.", methods: ["Laser engraving", "UV printing"], minQty: 1, priceFrom: "GH₵ 150", unit: "per piece", leadTime: "4–10 days", icon: "fa-solid fa-trophy", featured: true, order: 16 },
  { id: "custom-medal", name: "Custom Medal", category: "Awards & Recognition", description: "Medals with printed or engraved inserts and ribbons in your colours for sports days, graduations and competitions.", methods: ["UV printing", "Laser engraving"], minQty: 10, priceFrom: "GH₵ 30", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-medal", featured: false, order: 17 },
  { id: "award-plaque", name: "Award Plaque", category: "Awards & Recognition", description: "Wooden or acrylic plaques for appreciation, long service, retirement and citations.", methods: ["Laser engraving", "UV printing"], minQty: 1, priceFrom: "GH₵ 180", unit: "per piece", leadTime: "4–7 days", icon: "fa-solid fa-award", featured: false, order: 18 },
  { id: "picture-frame", name: "Custom Picture Frame", category: "Frames & Décor", description: "Modern and classic frames with printed photos and optional engraved name plate. Perfect for weddings, graduations and memorials.", methods: ["Photo printing", "Laser engraving", "UV printing"], minQty: 1, priceFrom: "GH₵ 120", unit: "per piece", leadTime: "3–7 days", icon: "fa-solid fa-image", featured: true, order: 19 },
  { id: "acrylic-photo-block", name: "Acrylic Photo Block", category: "Frames & Décor", description: "Free-standing acrylic block printed with a photo or message. A modern desk keepsake and gift.", methods: ["UV printing"], minQty: 1, priceFrom: "GH₵ 150", unit: "per piece", leadTime: "3–7 days", icon: "fa-regular fa-image", featured: false, order: 20 },
  { id: "branded-notebook", name: "Branded Notebook & Diary", category: "Office & Stationery", description: "Hardcover notebooks and diaries with debossed, engraved or printed logos for staff, clients and conferences.", methods: ["UV printing", "Laser engraving", "Debossing"], minQty: 10, priceFrom: "GH₵ 60", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-book", featured: false, order: 21 },
  { id: "branded-pen", name: "Branded Pen", category: "Office & Stationery", description: "Plastic and metal pens printed or engraved with your logo. Affordable giveaways for events and offices.", methods: ["Pad printing", "Laser engraving", "UV printing"], minQty: 50, priceFrom: "GH₵ 6", unit: "per piece", leadTime: "4–7 days", icon: "fa-solid fa-pen", featured: false, order: 22 },
  { id: "branded-gift-box", name: "Branded Gift Box", category: "Packaging", description: "Rigid or folding gift boxes printed with your logo, ideal for corporate gift packs and product presentation.", methods: ["Digital printing", "UV printing", "Sticker labels"], minQty: 10, priceFrom: "GH₵ 25", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-gift", featured: false, order: 23 },
  { id: "branded-paper-bag", name: "Branded Paper Bag & Product Packaging", category: "Packaging", description: "Paper bags, pouches and product labels that make your shop, bakery or small business look professional.", methods: ["Digital printing", "Sticker labels"], minQty: 50, priceFrom: "GH₵ 8", unit: "per piece", leadTime: "5–10 days", icon: "fa-solid fa-box", featured: false, order: 24 }
];

export const PRODUCT_CATEGORIES = ["Timepieces", "Tech Accessories", "Drinkware", "Apparel", "Print & Signage", "Awards & Recognition", "Frames & Décor", "Office & Stationery", "Packaging"];
