// Default content. The site renders this instantly and replaces it with live
// Firestore data when available. The admin dashboard can import all of it into
// Firestore in one click (Settings → Import default content).

export const DEFAULT_SETTINGS = {
  name: "Benjamin Amoako",
  brand: "ProfJero",
  title: "Full-Stack Developer & IT Trainer",
  roles: ["Full-Stack Developer", "Backend Engineer", "Systems Builder", "IT Trainer", "UI/UX Designer"],
  heroGreeting: "Hi, I'm Benjamin Amoako",
  heroIntro: "I design and build fast, secure web applications, dashboards and business systems — from the interface people love to the APIs and databases that power it. I also train the next generation of African tech talent.",
  availability: "Available for new projects",
  available: true,
  careerStart: "2021-01",          // experience is calculated from this date and grows every year
  projectsDone: 46,
  happyClients: 42,
  studentsTrained: 0,              // set in the admin dashboard; hidden when 0
  avatar: "/assets/img/people/benjamin-amoako.webp",
  heroImage: "/assets/img/people/profjero-at-work.webp",
  cvUrl: "",
  aboutTitle: "Full-stack developer who builds systems that work in the real world",
  about: [
    "I'm Benjamin Amoako — known as ProfJero — a full-stack developer and IT trainer based in Cape Coast, Ghana. For {years} years I have been turning ideas into reliable digital products: websites, e-learning platforms, admin dashboards, point-of-sale and inventory systems.",
    "On the front end I craft accessible, responsive interfaces. On the back end I design databases, authentication, REST APIs and serverless functions with Node.js, PHP, Firebase and SQL — so you get one person who understands the whole system end to end.",
    "I am the Co-Founder and Executive Director of Digital Bridge Initiative and the Founder of ProfJero Hub, where our studios combine technology, creativity, nutrition and agriculture to create impact. I love teaching, and I'm always open to collaborations that move people and businesses forward."
  ],
  email: "profjero947@gmail.com",
  phone: "+233 53 120 7256",
  whatsapp: "233531207256",
  location: "Cape Coast, Ghana",
  education: "BSc. Information Technology",
  languages: "English, Twi, Fante",
  socials: {
    whatsapp: "https://wa.me/233531207256",
    facebook: "https://www.facebook.com/profile.php?id=61585853362550",
    tiktok: "https://www.tiktok.com/@profjero",
    youtube: "",
    linkedin: "",
    github: "",
    x: "",
    instagram: ""
  },
  hubUrl: "https://profjerohub.pages.dev",
  seo: {
    title: "ProfJero — Benjamin Amoako | Full-Stack Developer & IT Trainer in Ghana",
    description: "Benjamin Amoako (ProfJero) is a full-stack developer and IT trainer in Cape Coast, Ghana, building fast, secure websites, web apps, dashboards and business systems with demos you can try.",
    keywords: "ProfJero, Prof Jero, Benjamin Amoako, full-stack developer Ghana, web developer Cape Coast, software developer Ghana, backend developer, IT trainer, Firebase developer, web apps, POS system Ghana",
    ogImage: "/assets/img/brand/og-image.jpg"
  },
  process: [
    { icon: "fa-solid fa-magnifying-glass-chart", title: "Discover", text: "We clarify your goals, users and must-have features, then agree on scope, timeline and budget." },
    { icon: "fa-solid fa-pen-ruler", title: "Design", text: "Wireframes and polished UI so you can see and approve the product before a line of code." },
    { icon: "fa-solid fa-code", title: "Build", text: "Front end, back end, database and admin dashboard — with weekly demos so you're never in the dark." },
    { icon: "fa-solid fa-rocket", title: "Launch & Support", text: "Deployment, SEO, training for your team and ongoing support as your business grows." }
  ],
  pricing: [
    { name: "Starter", price: "GH₵ 1,000", note: "Starting from", featured: false, features: ["Landing page or small website", "Responsive, mobile-first design", "SEO-ready structure & Google indexing", "Contact form & WhatsApp integration", "1 month free support"] },
    { name: "Business", price: "GH₵ 3,000", note: "Starting from", featured: true, features: ["Custom web app or business system", "Admin dashboard", "Database & user authentication", "Cloud hosting & media storage setup", "3 months free support"] },
    { name: "Enterprise", price: "GH₵ 7,000", note: "Starting from", featured: false, features: ["Fully custom software platform", "Advanced roles, analytics & reports", "Assessment, LMS or management systems", "API & third-party integrations", "Long-term scalability support"] }
  ],
  faqs: [
    { q: "What kind of projects do you build?", a: "Websites, web applications, admin dashboards, e-learning platforms, inventory and point-of-sale systems, and APIs. I handle both the front end and the back end, so I can deliver a complete system." },
    { q: "Which technologies do you use?", a: "HTML, CSS, JavaScript and React on the front end; Node.js, PHP, Firebase/Firestore, MySQL and REST APIs on the back end; Cloudflare, Cloudinary and Google Cloud for hosting and media. I choose the stack that fits your budget and goals." },
    { q: "How long does a project take?", a: "A landing page usually takes 1–2 weeks. A business system with an admin dashboard typically takes 4–8 weeks depending on features. You get a clear timeline before we start." },
    { q: "Can I try your systems before hiring you?", a: "Yes. Most projects in my portfolio have live demos and video walkthroughs on YouTube or TikTok, so you can see exactly how they work." },
    { q: "Do you work with clients outside Ghana?", a: "Yes. I work remotely with clients anywhere and communicate via WhatsApp, email and video calls." },
    { q: "Do you offer training?", a: "Yes. I train individuals, schools and organisations in web development, digital skills and IT, both in person and online." }
  ],
  footerText: "Building solutions. Empowering lives. Full-stack development, IT training and creative studios from Cape Coast to the world.",
  announcement: ""                    // optional banner text shown at the top of the site
};

export const DEFAULT_SKILLS = [
  { name: "HTML5 & Semantic Markup", level: 95, group: "Frontend", order: 1 },
  { name: "CSS3, Tailwind & Bootstrap", level: 92, group: "Frontend", order: 2 },
  { name: "JavaScript (ES2023+)", level: 88, group: "Frontend", order: 3 },
  { name: "React", level: 78, group: "Frontend", order: 4 },
  { name: "Node.js & Express", level: 80, group: "Backend", order: 5 },
  { name: "PHP", level: 82, group: "Backend", order: 6 },
  { name: "REST APIs & Serverless Functions", level: 84, group: "Backend", order: 7 },
  { name: "Authentication & Security", level: 80, group: "Backend", order: 8 },
  { name: "Firebase / Firestore", level: 86, group: "Databases & Cloud", order: 9 },
  { name: "MySQL & SQL", level: 82, group: "Databases & Cloud", order: 10 },
  { name: "MongoDB", level: 70, group: "Databases & Cloud", order: 11 },
  { name: "Cloudflare, Cloudinary & Deployment", level: 85, group: "Databases & Cloud", order: 12 },
  { name: "WordPress", level: 80, group: "Tools & Design", order: 13 },
  { name: "UI/UX Design (Figma)", level: 85, group: "Tools & Design", order: 14 },
  { name: "Graphic Design & Branding", level: 90, group: "Tools & Design", order: 15 },
  { name: "Git & GitHub", level: 82, group: "Tools & Design", order: 16 }
];

export const DEFAULT_STUDIOS = [
  {
    id: "digital-studio", name: "Digital Studio", order: 1, active: true,
    icon: "fa-solid fa-laptop-code", color: "#0A60EE",
    tagline: "Software, web, mobile & cloud",
    description: "Custom software, websites, mobile apps and cloud solutions that help businesses run better.",
    url: "https://profjerohub.pages.dev/#digital-studio",
    services: [
      { title: "Software Development", text: "Custom software tailored to your business — from desktop tools to enterprise systems — scalable, secure and fast." },
      { title: "Web Development", text: "Robust, SEO-ready websites and web applications with admin dashboards, databases and integrations." },
      { title: "Mobile App Development", text: "iOS and Android apps focused on performance, great user experience and seamless functionality." },
      { title: "Cloud & Backend", text: "APIs, databases, authentication and cloud hosting on Firebase, Cloudflare, AWS, Azure or Google Cloud." }
    ]
  },
  {
    id: "creative-studio", name: "Creative Studio", order: 2, active: true,
    icon: "fa-solid fa-palette", color: "#7C3AED",
    tagline: "Brand, design & video",
    description: "Brand identities, graphics, UI/UX and video that make people remember you.",
    url: "https://profjerohub.pages.dev/#creative-studio",
    services: [
      { title: "Branding & Identity", text: "Logos, brand guidelines and complete identity systems that tell your story and connect with your audience." },
      { title: "Graphic Design", text: "Flyers, social media designs, packaging and print materials that capture your message." },
      { title: "UI/UX Design", text: "Research-driven, beautiful interfaces that make digital products easy and delightful to use." },
      { title: "Video Editing", text: "Promotional videos and social media content edited to capture attention and tell your story." }
    ]
  },
  {
    id: "nourish-studio", name: "Nourish Studio", order: 3, active: true,
    icon: "fa-solid fa-seedling", color: "#08BC6F",
    tagline: "Nutrition & wellness",
    description: "Evidence-based nutrition and wellness programmes for individuals and organisations.",
    url: "https://profjerohub.pages.dev/#nourish-studio",
    services: [
      { title: "Nutrition Consulting", text: "Personalised nutrition plans that support your health goals with evidence-based guidance." },
      { title: "Wellness Programs", text: "Holistic programmes that improve mental and physical wellbeing for individuals and teams." },
      { title: "Meal Planning", text: "Weekly meal plans tailored to your preferences and health objectives — eat better, save time." }
    ]
  },
  {
    id: "agro-studio", name: "Agro Studio", order: 4, active: true,
    icon: "fa-solid fa-tractor", color: "#D97706",
    tagline: "Smart farming & agri-tech",
    description: "Technology and expert advice that help farms grow more with less.",
    url: "https://profjerohub.pages.dev/#agro-studio",
    services: [
      { title: "Smart Farming", text: "IoT and automation for efficient crop management, higher yields and less waste." },
      { title: "Crop Consulting", text: "Expert advice on crop selection, soil health and sustainable farming practices." },
      { title: "Agri-Tech Solutions", text: "From drone monitoring to data analytics — modern technology for traditional agriculture." }
    ]
  }
];

export const DEFAULT_PROJECTS = [
  {
    id: "dbi-learn", title: "DBI Learn", category: "Web Apps", order: 1, featured: true, status: "live", year: 2025,
    client: "Digital Bridge Initiative",
    summary: "Interactive e-learning platform with courses, multimedia lessons, quizzes and learner progress tracking.",
    description: "DBI Learn is the learning platform of Digital Bridge Initiative. Learners enrol in courses, watch lessons, take quizzes and track their progress, while administrators manage courses and learners from a dashboard.\n\n- Course and lesson management\n- Learner progress tracking\n- Video lessons and quizzes\n- Certificates on completion\n- Admin dashboard",
    tech: ["HTML5", "CSS3", "JavaScript", "Firebase", "Cloudflare Pages"],
    cover: "", liveUrl: "https://dbi-learn.pages.dev", demoUrl: "https://dbi-learn.pages.dev", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "rural-tech-hub", title: "Rural Tech Hub", category: "Websites", order: 2, featured: true, status: "live", year: 2026,
    client: "Rural Tech Hub",
    summary: "Platform connecting rural youth in Ghana with IT training programmes, events and digital opportunities.",
    description: "Rural Tech Hub brings quality IT education to young people in rural communities. The platform presents programmes (software development, design, data analysis, digital marketing), upcoming events with registration, and impact stories.",
    tech: ["HTML5", "CSS3", "JavaScript", "Cloudflare Pages"],
    cover: "", liveUrl: "https://ruraltech.pages.dev", demoUrl: "https://ruraltech.pages.dev", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "rth-admin", title: "Rural Tech Hub Admin", category: "Dashboards", order: 3, featured: true, status: "live", year: 2026,
    client: "Rural Tech Hub",
    summary: "Secure admin control centre to manage students, programmes, events, mentors and impact reports.",
    description: "The back office behind Rural Tech Hub. Administrators manage student profiles and certificates, programmes and schedules, events and registrations, and monitor impact with analytics — with role-based access for team members.",
    tech: ["JavaScript", "Firebase Auth", "Firestore", "Chart.js"],
    cover: "", liveUrl: "https://rthadmins.pages.dev", demoUrl: "https://rthadmins.pages.dev", videoUrl: "", repoUrl: "", demoNote: "Ask for demo login credentials via WhatsApp."
  },
  {
    id: "dbi-impact", title: "DBI Impact Dashboard", category: "Dashboards", order: 4, featured: false, status: "live", year: 2025,
    client: "Digital Bridge Initiative",
    summary: "Impact tracking dashboard showcasing programme outcomes, success metrics and beneficiary stories.",
    description: "An analytics dashboard that turns Digital Bridge Initiative's programme data into clear, interactive charts: year-over-year metrics, completion rates and beneficiary stories, with data export for reports.",
    tech: ["JavaScript", "Chart.js", "Data Visualisation"],
    cover: "", liveUrl: "https://dbi-impact.pages.dev", demoUrl: "https://dbi-impact.pages.dev", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "digital-bridge-initiative", title: "Digital Bridge Initiative", category: "Websites", order: 5, featured: false, status: "live", year: 2025,
    client: "Digital Bridge Initiative",
    summary: "Official website of a non-profit bridging the digital divide through technology education.",
    description: "The main website of Digital Bridge Initiative: mission and vision, programmes, volunteer portal, success stories and ways to support.",
    tech: ["HTML5", "CSS3", "Bootstrap", "JavaScript"],
    cover: "", liveUrl: "https://digitalbridgeinitiative.pages.dev", demoUrl: "https://digitalbridgeinitiative.pages.dev", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "smartinventory", title: "SmartInventory", category: "Business Systems", order: 6, featured: false, status: "live", year: 2025,
    client: "Small & medium businesses",
    summary: "Inventory and warehouse management with real-time stock, purchases, sales, multi-location and reports.",
    description: "SmartInventory gives small and medium businesses accurate stock control: real-time stock levels with low-stock alerts, purchase-to-sale flow with invoicing, multi-location transfers, role-based access and clear reports on best sellers, slow movers and margins.",
    tech: ["PHP", "MySQL", "JavaScript", "Chart.js"],
    cover: "", liveUrl: "/docs.html", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: "Request a guided demo via WhatsApp."
  },
  {
    id: "pharmacy-pos", title: "Pharmacy POS System", category: "Business Systems", order: 7, featured: false, status: "live", year: 2024,
    client: "Community pharmacy",
    summary: "Point-of-sale and stock management for a pharmacy — fast checkout, stock levels and daily sales reports.",
    description: "A fast, reliable point-of-sale system built for a pharmacy: barcode-friendly checkout, stock tracking with expiry and low-stock alerts, and daily sales reports.",
    tech: ["PHP", "MySQL", "JavaScript"],
    cover: "", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: "Private client system — demo video available on request."
  },
  {
    id: "tourizto", title: "Tourizto Travel Website", category: "Websites", order: 8, featured: false, status: "concept", year: 2023,
    client: "Concept",
    summary: "Travel booking website design with destination search and featured offers.",
    description: "A travel agency website concept with hero search, featured destinations and offer cards.",
    tech: ["WordPress", "Elementor"], cover: "/assets/img/work/tourizto-website.webp", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "dna-brand", title: "DNA Brand Identity", category: "Branding & Design", order: 9, featured: false, status: "delivered", year: 2024,
    client: "Creative Studio", summary: "Complete brand identity and merchandise system.", description: "Logo, colour system and branded merchandise from stationery to apparel.",
    tech: ["Branding", "Illustrator"], cover: "/assets/img/work/dna-brand-identity.webp", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "sanfas-brand", title: "Sanfas Brand Identity", category: "Branding & Design", order: 10, featured: false, status: "delivered", year: 2024,
    client: "Creative Studio", summary: "Corporate identity applied across uniforms, bags and stationery.", description: "Brand mark and identity applied to corporate merchandise.",
    tech: ["Branding", "Mockups"], cover: "/assets/img/work/sanfas-brand-identity.webp", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "photo-retouching", title: "Beauty Photo Retouching", category: "Branding & Design", order: 11, featured: false, status: "delivered", year: 2024,
    client: "Creative Studio", summary: "High-end skin retouching and colour grading.", description: "Professional beauty retouching that keeps natural texture.",
    tech: ["Photoshop"], cover: "/assets/img/work/photo-retouching.webp", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: ""
  },
  {
    id: "sabs-kitchen", title: "Sab's Kitchen Flyer", category: "Branding & Design", order: 12, featured: false, status: "delivered", year: 2024,
    client: "Sab's Kitchen", summary: "Promotional food flyer for a local restaurant.", description: "Eye-catching food flyer designed for print and social media.",
    tech: ["Photoshop", "Print"], cover: "/assets/img/work/sabs-kitchen-flyer.webp", liveUrl: "", demoUrl: "", videoUrl: "", repoUrl: "", demoNote: ""
  }
];

export const DEFAULT_TESTIMONIALS = [
  {
    id: "dbi", name: "Digital Bridge Initiative", role: "Non-profit organisation", rating: 5, order: 1, visible: true,
    avatar: "/assets/img/people/dbi-logo.webp",
    text: "ProfJero played a key role in building Digital Bridge Initiative's official website, assessment platform and admin portal. His ability to translate our ideas into functional, user-friendly systems greatly improved how we manage training, learners, assessments and administration. The solutions delivered were practical, reliable and well-structured."
  },
  {
    id: "rev-eric", name: "Rev. Eric", role: "Church leader", rating: 5, order: 2, visible: true,
    avatar: "/assets/img/people/rev-eric.webp",
    text: "Working with ProfJero to build our church website has been a true blessing. The design is clean, modern and beautifully reflects our mission and values. Members can now access sermons, events and updates with ease. His dedication, creativity and technical skill brought our vision to life."
  },
  {
    id: "edmond", name: "Edmond", role: "Pharmacy owner", rating: 5, order: 3, visible: true,
    avatar: "/assets/img/people/edmond.webp",
    text: "Since ProfJero deployed our new POS system, managing our pharmacy has been smoother. From tracking stock levels to generating daily sales reports, everything is now just a click away. It's fast and reliable. He understood our needs, delivered on time and exceeded expectations."
  }
];

export const DEFAULT_EXPERIENCE = [
  { id: "exp-hub", type: "work", title: "Founder", org: "ProfJero Hub", start: "2024", end: "Present", order: 1, text: "Leading Digital, Creative, Nourish and Agro studios that deliver software, design, wellness and agri-tech solutions." },
  { id: "exp-dbi", type: "work", title: "Co-Founder & Executive Director", org: "Digital Bridge Initiative", start: "2024", end: "Present", order: 2, text: "Building the organisation's platforms (website, DBI Learn, assessments, admin portal, impact dashboard) and leading digital-skills programmes." },
  { id: "exp-aquila", type: "work", title: "IT & Design Professional", org: "Aquila Apex", start: "2023", end: "Present", order: 3, text: "Delivering IT, graphic design, branding and UI/UX projects with cross-functional teams for client satisfaction and growth." },
  { id: "exp-freelance", type: "work", title: "Freelance Full-Stack Developer", org: "Self-employed", start: "2021", end: "Present", order: 4, text: "Websites, POS and inventory systems, church and business platforms for clients — from requirements to deployment and support." },
  { id: "edu-it", type: "education", title: "BSc. Information Technology", org: "University", start: "", end: "", order: 5, text: "Programming, web development, databases, networking and systems analysis." },
  { id: "edu-python", type: "education", title: "Python Programming", org: "Professional course", start: "2023", end: "2024", order: 6, text: "Data types, control flow, functions, OOP and data structures through practical projects." },
  { id: "edu-php", type: "education", title: "PHP & MySQL", org: "Professional course", start: "2021", end: "2022", order: 7, text: "Dynamic web applications, databases and PHP frameworks." }
];
