export const marketingLocales = ["sq", "en", "de"] as const;

export type MarketingLocale = (typeof marketingLocales)[number];

export function isMarketingLocale(value: string): value is MarketingLocale {
  return marketingLocales.includes(value as MarketingLocale);
}

type MarketingContent = {
  localeLabel: string;
  languageName: string;
  metaTitle: string;
  metaDescription: string;
  nav: {
    home: string;
    services: string;
    howItWorks: string;
    about: string;
    contact: string;
    login: string;
    menu: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    reassurance: string;
    statLabels: string[];
  };
  problem: {
    title: string;
    intro: string;
    points: string[];
    competitorTitle: string;
    competitorPoints: string[];
  };
  servicesPreview: {
    title: string;
    intro: string;
    items: Array<{ title: string; description: string }>;
  };
  trust: {
    title: string;
    intro: string;
    items: string[];
  };
  process: {
    title: string;
    intro: string;
    steps: Array<{ title: string; description: string }>;
  };
  scope: {
    title: string;
    intro: string;
    bullets: string[];
  };
  cta: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
  };
  packagesPage: {
    introTitle: string;
    introBody: string;
    note: string;
    packages: Array<{
      name: string;
      sixMonthPrice: string;
      twelveMonthPrice: string;
      sixMonthMonthly: string;
      twelveMonthMonthly: string;
      visits: string;
      summary: string;
      includes: string[];
      excludes: string;
    }>;
    exclusions: {
      title: string;
      items: string[];
    };
  };
  servicesPage: {
    introTitle: string;
    introBody: string;
    categories: Array<{
      title: string;
      summary: string;
      actions: string[];
      outcome: string;
    }>;
    note: string;
  };
  howPage: {
    introTitle: string;
    introBody: string;
    steps: Array<{ title: string; body: string }>;
    expectationsTitle: string;
    expectations: string[];
    objectionsTitle: string;
    objections: Array<{ question: string; answer: string }>;
  };
  aboutPage: {
    introTitle: string;
    introBody: string;
    valuesTitle: string;
    values: Array<{ title: string; body: string }>;
    closing: string;
  };
  contactPage: {
    introTitle: string;
    introBody: string;
    methodsTitle: string;
    methods: Array<{ title: string; description: string }>;
    formTitle: string;
    formBody: string;
    formLabels: {
      name: string;
      contact: string;
      abroad: string;
      country: string;
      area: string;
      message: string;
      submit: string;
    };
    formOptions: {
      yes: string;
      no: string;
    };
    helper: string;
    feedback: {
      submitting: string;
      fallback: string;
    };
  };
  footer: {
    line: string;
    login: string;
  };
};

export const marketingContent: Record<MarketingLocale, MarketingContent> = {
  en: {
    localeLabel: "EN",
    languageName: "English",
    metaTitle: "STREHË | Apartment care in Prishtina and Fushë Kosovë",
    metaDescription:
      "Trusted local care for diaspora apartment owners living abroad. Regular checks, practical coordination, and clear updates from Prishtina and Fushë Kosovë.",
    nav: {
      home: "Home",
      services: "Services",
      howItWorks: "How It Works",
      about: "About",
      contact: "Contact",
      login: "Portal Login",
      menu: "Menu",
    },
    hero: {
      eyebrow: "For apartment owners living abroad",
      title:
        "Trusted local care for your apartment in Prishtina or Fushë Kosovë while you live abroad.",
      description:
        "We regularly check, care for, and coordinate your apartment so you are not left wondering what is happening while you are away.",
      primaryCta: "Ask us a quick question on WhatsApp",
      secondaryCta: "View Services",
      reassurance: "We usually reply the same day.",
      statLabels: ["Apartments only at launch", "Prishtina and Fushë Kosovë", "Clear updates after visits"],
    },
    problem: {
      title: "Why owners need this",
      intro:
        "An empty apartment is easy to forget until something small becomes expensive, stressful, or urgent.",
      points: [
        "No one checks the apartment consistently.",
        "Small problems are noticed too late.",
        "Trips back to Kosovo start with preventable stress.",
        "Relatives help when they can, but they are not a system.",
      ],
      competitorTitle: "The real competitor is usually informal help",
      competitorPoints: [
        "No clear schedule",
        "No reporting with photos",
        "No accountability when something is missed",
        "No single responsible point of contact",
      ],
    },
    servicesPreview: {
      title: "What STREHË handles",
      intro: "Practical support, explained clearly.",
      items: [
        {
          title: "Regular apartment checks",
          description: "We visit, check the condition, and report back clearly.",
        },
        {
          title: "Arrival-ready preparation",
          description: "We help make sure the apartment feels ready before you return.",
        },
        {
          title: "Issue reporting and follow-up",
          description: "If something needs attention, we identify it early and follow up locally.",
        },
        {
          title: "Practical local coordination",
          description: "We handle the small but important tasks that are hard to manage from abroad.",
        },
      ],
    },
    trust: {
      title: "Why trust STREHË",
      intro:
        "Trust should not depend on nice adjectives. It should come from clear process and visible responsibility.",
      items: [
        "A focused launch area instead of vague nationwide claims",
        "Apartments only at launch, so the service stays disciplined",
        "Regular visits with clear updates",
        "One local point of contact for follow-up",
        "A structured service, not improvised favors",
      ],
    },
    process: {
      title: "How it works",
      intro: "The first step should feel simple, not heavy.",
      steps: [
        {
          title: "You contact us",
          description: "We start with a short conversation about the apartment and your needs.",
        },
        {
          title: "We understand the setup",
          description: "We clarify what matters most, what should be checked, and how often.",
        },
        {
          title: "We agree the right support",
          description: "We keep the service practical and matched to your apartment.",
        },
        {
          title: "We start visits and send updates",
          description: "After visits, you receive clear follow-up instead of uncertainty.",
        },
      ],
    },
    scope: {
      title: "Focused launch scope",
      intro: "Specificity is part of the trust story.",
      bullets: [
        "Prishtina",
        "Fushë Kosovë",
        "Apartments only at launch",
        "A focused service designed specifically for apartments",
      ],
    },
    cta: {
      title: "A calm first conversation is enough",
      description:
        "Tell us where you live, where the apartment is, and what kind of support you need.",
      primary: "Ask us on WhatsApp",
      secondary: "Request Information",
    },
    packagesPage: {
      introTitle: "Three clear packages for apartment care in Prishtina and Fushë Kosovë",
      introBody:
        "Every package includes scheduled visits, condition checks, photos, and owner updates. The right choice depends on how often you want the apartment visited and how much support you need between visits.",
      note: "All visits are scheduled in advance. Repairs, parts, materials, deep cleaning, and third-party contractor costs are charged separately. Launch area: Prishtina and Fushë Kosovë. Apartments only.",
      packages: [
        {
          name: "Essential Check",
          sixMonthPrice: "€450",
          twelveMonthPrice: "€840",
          sixMonthMonthly: "€75/month",
          twelveMonthMonthly: "€70/month",
          visits: "1 scheduled visit per month",
          summary: "Basic reassurance. Someone checks the apartment regularly and you receive a clear update.",
          includes: [
            "1 scheduled visit per month",
            "Visible-condition inspection",
            "Access and readiness check",
            "Doors, windows, and basic property-condition check",
            "Visible moisture, leak, and problem check",
            "Useful photos",
            "Short owner update after each visit",
            "Issue notification",
          ],
          excludes: "Cleaning, repairs, and unlimited coordination are not included.",
        },
        {
          name: "Care Plus",
          sixMonthPrice: "€720",
          twelveMonthPrice: "€1,320",
          sixMonthMonthly: "€120/month",
          twelveMonthMonthly: "€110/month",
          visits: "2 scheduled visits per month",
          summary: "Stronger oversight. More frequent visits, earlier issue detection, and practical local follow-up.",
          includes: [
            "2 scheduled visits per month",
            "Everything in Essential Check",
            "Update after each visit",
            "More frequent issue detection",
            "Reasonable issue follow-up",
            "Basic local support related to the apartment",
          ],
          excludes: "Unlimited contractor or project coordination. Substantial work becomes an additional service.",
        },
        {
          name: "Arrival Ready",
          sixMonthPrice: "€990",
          twelveMonthPrice: "€1,890",
          sixMonthMonthly: "€165/month",
          twelveMonthMonthly: "€157.50/month",
          visits: "2 scheduled visits per month + Home Refresh",
          summary: "Full care including arrival preparation. The apartment is checked, maintained, and refreshed before you return.",
          includes: [
            "2 scheduled normal visits per month",
            "Everything in Care Plus",
            "1 included Home Refresh per 6-month term",
            "2 included Home Refreshes per 12-month term",
            "Pre-arrival readiness coordination",
            "The Home Refresh is an additional physical visit — it does not replace a normal visit",
          ],
          excludes: "Deep cleaning, repairs, parts, materials, and third-party contractor costs are charged separately.",
        },
      ],
      exclusions: {
        title: "What no package silently includes",
        items: [
          "Contractor fees",
          "Parts and materials",
          "Deep cleaning (unless separately agreed)",
          "Major repairs",
          "Unlimited errands",
          "Unlimited contractor coordination",
          "Rental management",
          "Guaranteed 24/7 emergency response",
        ],
      },
    },
    servicesPage: {
      introTitle: "Additional services for your apartment",
      introBody:
        "Beyond the recurring packages, STREHË can help with specific projects, preparation, and maintenance. These services are separate from the monthly visit rhythm and are quoted or priced individually.",
      categories: [
        {
          title: "Home Refresh",
          summary: "A light apartment reset to make the space comfortable and ready for arrival.",
          actions: [
            "Vacuuming and normal dust removal",
            "Wiping basic accessible surfaces",
            "Basic kitchen and bathroom surface reset",
            "Airing and ventilation",
            "Visible apartment-condition check",
            "Doors, windows, and access check",
            "Final readiness update",
          ],
          outcome: "You arrive to an apartment that feels fresh and cared for — not deep cleaned, but ready to use.",
        },
        {
          title: "Painting & Wall Refresh",
          summary: "Wall touch-ups, room repainting, or full-apartment painting.",
          actions: [
            "Wall touch-ups and spot repairs",
            "Single-room repainting",
            "Several rooms or full apartment",
            "From approximately €2.50/m² labour + materials",
            "Final quotation depends on wall condition, preparation, number of coats, furniture protection, and materials",
            "m² means actual paintable wall and ceiling surface, not apartment floor area",
          ],
          outcome: "Your apartment looks fresher and more cared for, whether it needs a small refresh or a full repaint.",
        },
        {
          title: "Deep Cleaning",
          summary: "Professional intensive cleaning beyond the scope of a Home Refresh.",
          actions: [
            "Provided through an approved cleaning partner",
            "Supplier and service cost quoted separately",
            "Ideal before arrival, after renovation, or for periodic deep cleaning",
          ],
          outcome: "A thorough professional clean that resets the apartment to a higher standard.",
        },
        {
          title: "Repairs & Maintenance",
          summary: "One category for all apartment repair and maintenance needs.",
          actions: [
            "Minor safe fixes — handles, hinges, fittings",
            "Plumber, electrician, locksmith",
            "AC and appliance issues",
            "Other apartment maintenance",
            "Simple safe work may be handled by STREHË directly",
            "Technical or specialist work goes to an appropriate professional",
            "Parts, materials, and specialist charges remain separate",
          ],
          outcome: "Issues are identified, reported, and resolved — without you having to chase local trades from abroad.",
        },
        {
          title: "Home Improvements & Renovation Support",
          summary: "Quotation or project basis for larger apartment work.",
          actions: [
            "Cosmetic refurbishment",
            "Furnishing and furniture setup",
            "Painting projects",
            "Fixture replacement",
            "Renovation coordination",
            "Contractor supervision",
            "Preparing an older apartment for renewed use",
          ],
          outcome: "STREHË coordinates, supervises, and reports. Specialist construction work is performed by qualified professionals — not directly by STREHË.",
        },
      ],
      note:
        "Every additional service is quoted or priced individually. Repairs, parts, materials, and third-party provider costs are not included in monthly package prices.",
    },
    howPage: {
      introTitle: "A simple process that reduces uncertainty from the first contact",
      introBody:
        "The service should feel personal and well-managed, not bureaucratic.",
      steps: [
        {
          title: "1. You contact us",
          body: "We start with a short conversation through WhatsApp, phone, or email.",
        },
        {
          title: "2. We understand the apartment",
          body: "We learn where it is, how often you are away, and what kind of support matters most.",
        },
        {
          title: "3. We agree the right setup",
          body: "We define the rhythm and practical scope before anything starts.",
        },
        {
          title: "4. We begin local follow-up",
          body: "Visits begin and updates follow, so you are not left guessing.",
        },
      ],
      expectationsTitle: "What owners should expect",
      expectations: [
        "Clear communication",
        "Visible follow-up",
        "A service matched to the apartment, not a generic package",
        "A local point of contact instead of scattered informal help",
      ],
      objectionsTitle: "Common questions",
      objections: [
        {
          question: "What if something breaks?",
          answer: "It should be identified early, explained clearly, and followed up locally.",
        },
        {
          question: "What if I need urgent help?",
          answer: "The service should make it easier to react quickly because there is already a local contact path.",
        },
        {
          question: "What if I am not satisfied?",
          answer: "The relationship should stay transparent, calm, and accountable from the start.",
        },
      ],
    },
    aboutPage: {
      introTitle: "A local service for owners who cannot keep watch from abroad",
      introBody:
        "STREHË exists to replace uncertainty with clear local care. The goal is not to sound impressive. The goal is to make owners feel safe handing over responsibility.",
      valuesTitle: "How we work",
      values: [
        {
          title: "Focused",
          body: "Launch scope stays narrow so the service can stay disciplined and credible.",
        },
        {
          title: "Accountable",
          body: "Trust is built through visits, updates, and follow-up, not just nice words.",
        },
        {
          title: "Calm",
          body: "The service should reduce pressure on owners and families, not add more noise.",
        },
      ],
      closing:
        "For diaspora owners, what matters most is simple: one reliable local setup that cares for the apartment while they are away.",
    },
    contactPage: {
      introTitle: "Start with a simple question",
      introBody:
        "You do not need a long process to begin. A short message is enough for us to understand whether the service fits your apartment.",
      methodsTitle: "Best ways to reach us",
      methods: [
        {
          title: "WhatsApp",
          description: "Best for a fast first conversation and same-day replies when possible.",
        },
        {
          title: "Email",
          description: "Best when you want to explain your situation in a bit more detail.",
        },
        {
          title: "Phone",
          description: "Best for urgent or direct conversations.",
        },
      ],
      formTitle: "Request information",
      formBody:
        "Send the essentials and we will prepare a clear reply instead of a generic sales message.",
      formLabels: {
        name: "Name",
        contact: "Email or phone",
        abroad: "Do you live abroad?",
        country: "Country where you live",
        area: "Apartment area",
        message: "Message",
        submit: "Send request",
      },
      formOptions: {
        yes: "Yes",
        no: "No",
      },
      helper:
        "We use these details only to understand your request and reply. You can also contact us directly by email.",
      feedback: {
        submitting: "Sending...",
        fallback: "Send by email",
      },
    },
    footer: {
      line: "Trusted local care for apartments in Prishtina and Fushë Kosovë.",
      login: "Portal Login",
    },
  },
  sq: {
    localeLabel: "SQ",
    languageName: "Shqip",
    metaTitle: "STREHË | Kujdes lokal për apartamentin tuaj",
    metaDescription:
      "Kujdes lokal për pronarët e diasporës që jetojnë jashtë. Kontrolle të rregullta, koordinim praktik dhe përditësime të qarta për apartamente në Prishtinë dhe Fushë Kosovë.",
    nav: {
      home: "Ballina",
      services: "Shërbimet",
      howItWorks: "Si Funksionon",
      about: "Rreth Nesh",
      contact: "Kontakt",
      login: "Hyrja në Portal",
      menu: "Meny",
    },
    hero: {
      eyebrow: "Kujdes për apartamentet e diasporës",
      title:
        "Apartamenti juaj në Kosovë, i kontrolluar dhe i dokumentuar edhe kur jeni larg.",
      description:
        "STREHË bën vizita të planifikuara, dërgon raport me foto dhe ndjek çështjet praktike në Prishtinë dhe Fushë Kosovë.",
      primaryCta: "Na shkruani në WhatsApp",
      secondaryCta: "Shihni shërbimet",
      reassurance: "Zakonisht përgjigjemi brenda ditës.",
      statLabels: [
        "Raport me foto pas vizitës",
        "Prishtinë dhe Fushë Kosovë",
        "Një kontakt lokal përgjegjës",
      ],
    },
    problem: {
      title: "Kur jeni larg, mungesa e kontrollit kushton",
      intro:
        "Një problem i vogël në apartament mund të mbetet pa u vërejtur për muaj.",
      points: [
        "Kontrolle pa ritëm dhe pa dokumentim.",
        "Probleme të vogla që zbulohen shumë vonë.",
        "Kthim në Kosovë me punë dhe stres të papritur.",
      ],
      competitorTitle: "Favori nuk është sistem",
      competitorPoints: [
        "Pa orar të dakorduar",
        "Pa raport me foto",
        "Pa një person përgjegjës për ndjekje",
      ],
    },
    servicesPreview: {
      title:
        "Dikush kujdeset për apartamentin tuaj, edhe kur ju jeni jashtë Kosovës.",
      intro:
        "Vizita të planifikuara, fotografi dhe raport i qartë, plus ndjekje lokale kur diçka kërkon vëmendje.",
      items: [
        {
          title: "Kontrollojmë apartamentin",
          description:
            "Vizitojmë apartamentin sipas ritmit të dakorduar dhe kontrollojmë gjendjen e dukshme, hyrjen dhe shenjat e problemeve.",
        },
        {
          title: "Ju dërgojmë raport me fotografi",
          description:
            "Pas çdo vizite merrni një përmbledhje të qartë: çfarë u kontrollua, çfarë u pa dhe çfarë kërkon ndjekje.",
        },
        {
          title: "Ndjekim problemet lokale",
          description:
            "Kur shfaqet një problem, ju njoftojmë herët dhe koordinojmë hapat e radhës me miratimin tuaj.",
        },
        {
          title: "E përgatisim para kthimit",
          description:
            "Ajrosje, kontroll para ardhjes dhe koordinim i detajeve praktike që apartamenti të jetë gati.",
        },
      ],
    },
    trust: {
      title: "Kujdes lokal me kufij të qartë",
      intro:
        "E dini si dokumentohet vizita, kush e ndjek çështjen dhe kur kërkohet miratimi juaj.",
      items: [
        "Vizita të dokumentuara me datë dhe fotografi",
        "Një person lokal përgjegjës për ndjekjen",
        "Fillimisht në Prishtinë dhe Fushë Kosovë",
        "Asnjë punë shtesë pa miratimin tuaj, përveç rasteve të përcaktuara emergjente",
      ],
    },
    process: {
      title: "Nga mesazhi i parë te raporti pas vizitës.",
      intro: "Nga mesazhi i parë te raporti pas vizitës.",
      steps: [
        {
          title: "Na shkruani",
          description:
            "Na tregoni ku është apartamenti, sa shpesh qëndron bosh dhe çfarë ju shqetëson më shumë.",
        },
        {
          title: "Bëjmë një bisedë të shkurtër",
          description:
            "Qartësojmë nevojat, zonën dhe ritmin e përshtatshëm të vizitave.",
        },
        {
          title: "Ju propozojmë një plan të qartë",
          description:
            "Merrni një propozim me shërbimet, çmimin, përfshirjet dhe kufijtë e përgjegjësisë.",
        },
        {
          title: "Fillojnë vizitat dhe përditësimet",
          description:
            "Pas çdo vizite merrni raport të qartë dhe dini çfarë duhet bërë më pas.",
        },
      ],
    },
    scope: {
      title: "Fokus i qartë në nisje",
      intro: "Specifika është pjesë e historisë së besimit.",
      bullets: [
        "Prishtinë",
        "Fushë Kosovë",
        "Vetëm apartamente në nisje",
        "Shërbim i fokusuar dhe i krijuar posaçërisht për apartamente",
      ],
    },
    cta: {
      title: "Le të flasim për apartamentin tuaj",
      description:
        "Na tregoni ku ndodhet dhe çfarë ju shqetëson më shumë. Ne ju përgjigjemi me hapa të qartë.",
      primary: "Na shkruani në WhatsApp",
      secondary: "Shihni shërbimet",
    },
    packagesPage: {
      introTitle: "Tri paketa të qarta për kujdesin e apartamenteve në Prishtinë dhe Fushë Kosovë",
      introBody:
        "Çdo paketë përfshin vizita të planifikuara, kontrolle të gjendjes, fotografi dhe përditësime për pronarin. Zgjedhja e duhur varet nga sa shpesh doni të vizitohet apartamenti dhe sa mbështetje ju nevojitet ndërmjet vizitave.",
      note: "Të gjitha vizitat planifikohen paraprakisht. Riparimet, pjesët, materialet, pastrimi i thellë dhe kostot e kontraktorëve të jashtëm faturohen veçmas. Zona e nisjes: Prishtinë dhe Fushë Kosovë. Vetëm apartamente.",
      packages: [
        {
          name: "Essential Check",
          sixMonthPrice: "€450",
          twelveMonthPrice: "€840",
          sixMonthMonthly: "€75/muaj",
          twelveMonthMonthly: "€70/muaj",
          visits: "1 vizitë e planifikuar në muaj",
          summary: "Siguri bazë. Dikush kontrollon apartamentin rregullisht dhe ju merrni një përditësim të qartë.",
          includes: [
            "1 vizitë e planifikuar në muaj",
            "Inspektim i gjendjes së dukshme",
            "Kontroll i hyrjes dhe gatishmërisë",
            "Kontroll i dyerve, dritareve dhe gjendjes bazë",
            "Kontroll për lagështi, rrjedhje dhe probleme të dukshme",
            "Fotografi të dobishme",
            "Përditësim i shkurtër pas çdo vizite",
            "Njoftim për problemet",
          ],
          excludes: "Pastrimi, riparimet dhe koordinimi i pakufizuar nuk përfshihen.",
        },
        {
          name: "Care Plus",
          sixMonthPrice: "€720",
          twelveMonthPrice: "€1,320",
          sixMonthMonthly: "€120/muaj",
          twelveMonthMonthly: "€110/muaj",
          visits: "2 vizita të planifikuara në muaj",
          summary: "Mbikëqyrje më e fortë. Vizita më të shpeshta, zbulim më i hershëm i problemeve dhe ndjekje praktike lokale.",
          includes: [
            "2 vizita të planifikuara në muaj",
            "Gjithçka nga Essential Check",
            "Përditësim pas çdo vizite",
            "Zbulim më i shpeshtë i problemeve",
            "Ndjekje e arsyeshme e çështjeve",
            "Mbështetje bazë lokale për apartamentin",
          ],
          excludes: "Koordinimi i pakufizuar i kontraktorëve ose projekteve. Puna e konsiderueshme bëhet shërbim shtesë.",
        },
        {
          name: "Arrival Ready",
          sixMonthPrice: "€990",
          twelveMonthPrice: "€1,890",
          sixMonthMonthly: "€165/muaj",
          twelveMonthMonthly: "€157.50/muaj",
          visits: "2 vizita të planifikuara në muaj + Home Refresh",
          summary: "Kujdes i plotë duke përfshirë përgatitjen para ardhjes. Apartamenti kontrollohet, mirëmbahet dhe freskohet para kthimit tuaj.",
          includes: [
            "2 vizita normale të planifikuara në muaj",
            "Gjithçka nga Care Plus",
            "1 Home Refresh i përfshirë për çdo 6-mujor",
            "2 Home Refresh të përfshira për çdo 12-mujor",
            "Koordinim i gatishmërisë para ardhjes",
            "Home Refresh është vizitë fizike shtesë — nuk zëvendëson një vizitë normale",
          ],
          excludes: "Pastrimi i thellë, riparimet, pjesët, materialet dhe kostot e kontraktorëve të jashtëm faturohen veçmas.",
        },
      ],
      exclusions: {
        title: "Çfarë asnjë paketë nuk përfshin në heshtje",
        items: [
          "Tarifat e kontraktorëve",
          "Pjesët dhe materialet",
          "Pastrimin e thellë (përveçse kur dakordohet veçmas)",
          "Riparimet e mëdha",
          "Porositë e pakufizuara",
          "Koordinimin e pakufizuar të kontraktorëve",
          "Menaxhimin e qirasë",
          "Përgjigjen emergjente 24/7 të garantuar",
        ],
      },
    },
    servicesPage: {
      introTitle: "Shërbime shtesë për apartamentin tuaj",
      introBody:
        "Përtej paketave të përsëritura, STREHË mund të ndihmojë me projekte specifike, përgatitje dhe mirëmbajtje. Këto shërbime janë të ndara nga ritmi mujor i vizitave dhe kuotohen ose çmohen individualisht.",
      categories: [
        {
          title: "Home Refresh",
          summary: "Rikthim i lehtë i apartamentit për ta bërë hapësirën të rehatshme dhe gati para ardhjes.",
          actions: [
            "Fshesë me korrent dhe heqje pluhuri normale",
            "Pastrim i sipërfaqeve bazë të aksesueshme",
            "Rregullim bazë i kuzhinës dhe banjës",
            "Ajrosje dhe ventilim",
            "Kontroll i gjendjes së dukshme",
            "Kontroll i dyerve, dritareve dhe hyrjes",
            "Përditësim përfundimtar i gatishmërisë",
          ],
          outcome: "Mbërrini në një apartament që ndihet i freskët dhe i kujdesur — jo i pastruar thellë, por gati për përdorim.",
        },
        {
          title: "Lyhje & Rifreskim Muresh",
          summary: "Riparime të vogla të mureve, lyerje dhome ose lyerje e plotë e apartamentit.",
          actions: [
            "Riparime dhe korrigjime pikësore të mureve",
            "Lyerje e një dhome të vetme",
            "Disa dhoma ose apartament i plotë",
            "Nga rreth €2.50/m² punë + materiale",
            "Kuotimi përfundimtar varet nga gjendja e murit, përgatitja, numri i shtresave, mbrojtja e mobiljeve dhe materialet",
            "m² nënkupton sipërfaqen aktuale të murit dhe tavanit që lyhet, jo sipërfaqen e dyshemesë",
          ],
          outcome: "Apartamenti juaj duket më i freskët dhe më i kujdesur, qoftë për një rifreskim të vogël apo një lyerje të plotë.",
        },
        {
          title: "Pastrim i Thellë",
          summary: "Pastrim profesional intensiv përtej fushëveprimit të Home Refresh.",
          actions: [
            "Ofrohet përmes një partneri të aprovuar pastrimi",
            "Kostoja e furnizuesit dhe shërbimit kuotohet veçmas",
            "Ideal para ardhjes, pas rinovimit ose për pastrim periodik të thellë",
          ],
          outcome: "Një pastrim i plotë profesional që e rikthen apartamentin në një standard më të lartë.",
        },
        {
          title: "Riparime & Mirëmbajtje",
          summary: "Një kategori për të gjitha nevojat e riparimit dhe mirëmbajtjes së apartamentit.",
          actions: [
            "Rregullime të vogla të sigurta — doreza, mentesha, pajisje",
            "Hidraulik, elektricist, bravandreqës",
            "Probleme me kondicionerin dhe pajisjet elektrike",
            "Mirëmbajtje të tjera të apartamentit",
            "Punët e thjeshta të sigurta mund të kryhen drejtpërdrejt nga STREHË",
            "Puna teknike ose e specializuar i kalon një profesionisti të përshtatshëm",
            "Pjesët, materialet dhe tarifat e specializuara mbeten të ndara",
          ],
          outcome: "Problemet evidentohen, raportohen dhe zgjidhen — pa qenë nevoja që ju të ndiqni zejtarë lokalë nga jashtë.",
        },
        {
          title: "Përmirësime Shtëpie & Mbështetje për Rinovime",
          summary: "Bazë kuotimi ose projekti për punë më të mëdha apartamenti.",
          actions: [
            "Rinovim kozmetik",
            "Mobilim dhe vendosje orendish",
            "Projekte lyerjeje",
            "Zëvendësim pajisjesh",
            "Koordinim rinovimi",
            "Mbikëqyrje kontraktorësh",
            "Përgatitje e një apartamenti të vjetër për përdorim të ri",
          ],
          outcome: "STREHË koordinon, mbikëqyr dhe raporton. Puna e specializuar e ndërtimit kryhet nga profesionistë të kualifikuar — jo drejtpërdrejt nga STREHË.",
        },
      ],
      note:
        "Çdo shërbim shtesë kuotohet ose çmohet individualisht. Riparimet, pjesët, materialet dhe kostot e ofruesve të jashtëm nuk përfshihen në çmimet e paketave mujore.",
    },
    howPage: {
      introTitle: "Një proces i thjeshtë që ul pasigurinë që në kontaktin e parë",
      introBody:
        "Shërbimi duhet të ndihet personal dhe i menaxhuar mirë, jo burokratik.",
      steps: [
        {
          title: "1. Ju na kontaktoni",
          body: "Fillojmë me një bisedë të shkurtër përmes WhatsApp-it, telefonit ose email-it.",
        },
        {
          title: "2. E kuptojmë apartamentin",
          body: "Mësojmë ku ndodhet, sa shpesh jeni larg dhe çfarë ju intereson më së shumti.",
        },
        {
          title: "3. Dakordohemi për mënyrën e duhur",
          body: "Përcaktojmë ritmin dhe fushën praktike para se të fillojë puna.",
        },
        {
          title: "4. Fillon ndjekja lokale",
          body: "Vizitat nisin dhe përditësimet ju mbajnë të informuar.",
        },
      ],
      expectationsTitle: "Çfarë duhet të prisni",
      expectations: [
        "Komunikim të qartë",
        "Ndjekje të dukshme",
        "Shërbim të përshtatur për apartamentin tuaj",
        "Një kontakt lokal në vend të ndihmave të shpërndara",
      ],
      objectionsTitle: "Pyetje të shpeshta",
      objections: [
        {
          question: "Po nëse prishet diçka?",
          answer: "Duhet të vërehet herët, të shpjegohet qartë dhe të ndiqet lokalisht.",
        },
        {
          question: "Po nëse kam nevojë urgjente?",
          answer: "Shërbimi duhet ta bëjë reagimin më të shpejtë sepse ekziston tashmë rruga lokale e kontaktit.",
        },
        {
          question: "Po nëse nuk jam i kënaqur?",
          answer: "Marrëdhënia duhet të mbetet transparente, e qetë dhe me përgjegjësi që nga fillimi.",
        },
      ],
    },
    aboutPage: {
      introTitle: "Shërbim lokal për pronarët që nuk mund ta mbajnë vetë nën kujdes pronën nga jashtë",
      introBody:
        "STREHË ekziston për ta zëvendësuar pasigurinë me kujdes lokal të qartë. Qëllimi nuk është të dukemi mbresëlënës. Qëllimi është që pronari të ndihet i sigurt duke lënë përgjegjësinë në duart tona.",
      valuesTitle: "Si punojmë",
      values: [
        {
          title: "I fokusuar",
          body: "Shtrirja fillestare mbetet e ngushtë që shërbimi të jetë i disiplinuar dhe i besueshëm.",
        },
        {
          title: "Me përgjegjësi",
          body: "Besimi ndërtohet me vizita, njoftime dhe ndjekje, jo vetëm me fjalë të bukura.",
        },
        {
          title: "I qetë",
          body: "Shërbimi duhet t'ua ulë presionin pronarëve dhe familjeve, jo t'u shtojë zhurmë.",
        },
      ],
      closing:
        "Për pronarët në diasporë, gjëja më e rëndësishme është e thjeshtë: një sistem lokal i besueshëm që kujdeset për apartamentin ndërsa ata janë larg.",
    },
    contactPage: {
      introTitle: "Filloni me një pyetje të thjeshtë",
      introBody:
        "Nuk ju duhet një proces i gjatë për të filluar. Mjafton një mesazh i shkurtër që ne ta kuptojmë nëse shërbimi i përshtatet apartamentit tuaj.",
      methodsTitle: "Mënyrat më të mira për kontakt",
      methods: [
        {
          title: "WhatsApp",
          description: "Më i miri për një bisedë të shpejtë dhe përgjigje brenda ditës kur është e mundur.",
        },
        {
          title: "Email",
          description: "Më i miri kur doni ta shpjegoni situatën pak më gjerë.",
        },
        {
          title: "Telefon",
          description: "Më i miri për raste urgjente ose biseda të drejtpërdrejta.",
        },
      ],
      formTitle: "Kërkoni informata",
      formBody:
        "Dërgoni të dhënat kryesore dhe ne do t'ju kthejmë një përgjigje të qartë, jo një mesazh të përgjithshëm shitjeje.",
      formLabels: {
        name: "Emri",
        contact: "Email ose telefon",
        abroad: "A jetoni jashtë?",
        country: "Shteti ku jetoni",
        area: "Zona e apartamentit",
        message: "Mesazhi",
        submit: "Dërgo kërkesën",
      },
      formOptions: {
        yes: "Po",
        no: "Jo",
      },
      helper:
        "Këto të dhëna i përdorim vetëm për ta kuptuar kërkesën dhe për t'ju përgjigjur. Mund të na kontaktoni edhe drejtpërdrejt me email.",
      feedback: {
        submitting: "Duke dërguar...",
        fallback: "Dërgo me email",
      },
    },
    footer: {
      line: "Kujdes lokal i besueshëm për apartamente në Prishtinë dhe Fushë Kosovë.",
      login: "Hyrja në Portal",
    },
  },
  de: {
    localeLabel: "DE",
    languageName: "Deutsch",
    metaTitle: "STREHË | Lokale Betreuung für Ihre Wohnung",
    metaDescription:
      "Verlässliche lokale Betreuung für Eigentümer im Ausland. Regelmäßige Kontrollen, praktische Koordination und klare Updates für Wohnungen in Prishtina und Fushë Kosovë.",
    nav: {
      home: "Start",
      services: "Leistungen",
      howItWorks: "Ablauf",
      about: "Über Uns",
      contact: "Kontakt",
      login: "Portal-Login",
      menu: "Menü",
    },
    hero: {
      eyebrow: "Für Wohnungseigentümer im Ausland",
      title:
        "Verlässliche lokale Betreuung für Ihre Wohnung in Prishtina oder Fushë Kosovë, während Sie im Ausland leben.",
      description:
        "Wir kontrollieren Ihre Wohnung regelmäßig, kümmern uns um praktische Dinge vor Ort und halten Sie klar informiert, damit keine Unsicherheit entsteht.",
      primaryCta: "Schreiben Sie uns kurz auf WhatsApp",
      secondaryCta: "Leistungen ansehen",
      reassurance: "Wir antworten in der Regel noch am selben Tag.",
      statLabels: ["Zum Start nur Wohnungen", "Prishtina und Fushë Kosovë", "Klare Updates nach Besuchen"],
    },
    problem: {
      title: "Warum Eigentümer so einen Service brauchen",
      intro:
        "Eine leere Wohnung gerät leicht aus dem Blick, bis ein kleines Problem teuer, stressig oder dringend wird.",
      points: [
        "Niemand kontrolliert die Wohnung zuverlässig.",
        "Kleine Probleme werden zu spät bemerkt.",
        "Die Rückkehr nach Kosovo beginnt mit unnötigem Stress.",
        "Familie hilft oft, aber sie ist kein verlässliches System.",
      ],
      competitorTitle: "Der eigentliche Wettbewerber ist oft informelle Hilfe",
      competitorPoints: [
        "Kein klarer Rhythmus",
        "Keine Berichte mit Fotos",
        "Keine Verantwortung, wenn etwas übersehen wird",
        "Keine feste Ansprechperson",
      ],
    },
    servicesPreview: {
      title: "Worum sich STREHË kümmert",
      intro: "Praktische Leistungen, klar erklärt.",
      items: [
        {
          title: "Regelmäßige Wohnungschecks",
          description: "Wir besuchen die Wohnung, prüfen den Zustand und berichten klar zurück.",
        },
        {
          title: "Vorbereitung vor Ihrer Anreise",
          description: "Wir helfen dabei, dass die Wohnung vor Ihrer Rückkehr bereit ist.",
        },
        {
          title: "Meldung und Nachverfolgung von Problemen",
          description: "Wenn etwas Aufmerksamkeit braucht, erkennen wir es früh und kümmern uns vor Ort darum.",
        },
        {
          title: "Praktische lokale Koordination",
          description: "Wir übernehmen die kleinen, aber wichtigen Aufgaben, die aus dem Ausland schwer zu steuern sind.",
        },
      ],
    },
    trust: {
      title: "Warum STREHË vertrauenswürdig ist",
      intro:
        "Vertrauen sollte nicht nur auf netten Worten beruhen. Es sollte aus klaren Abläufen und sichtbarer Verantwortung entstehen.",
      items: [
        "Ein klar begrenztes Startgebiet statt vager landesweiter Versprechen",
        "Zum Start nur Wohnungen, damit der Service fokussiert bleibt",
        "Regelmäßige Besuche mit klaren Updates",
        "Eine lokale Ansprechperson für die Nachverfolgung",
        "Ein strukturierter Service statt improvisierter Gefälligkeiten",
      ],
    },
    process: {
      title: "So funktioniert es",
      intro: "Der erste Schritt soll leicht wirken, nicht schwer.",
      steps: [
        {
          title: "Sie kontaktieren uns",
          description: "Wir beginnen mit einem kurzen Gespräch über die Wohnung und Ihren Bedarf.",
        },
        {
          title: "Wir verstehen die Situation",
          description: "Wir klären, worauf geachtet werden soll und wie oft.",
        },
        {
          title: "Wir vereinbaren das passende Setup",
          description: "Der Service bleibt praktisch und passend zu Ihrer Wohnung.",
        },
        {
          title: "Wir starten Besuche und Updates",
          description: "Nach den Besuchen erhalten Sie klare Rückmeldungen statt Unsicherheit.",
        },
      ],
    },
    scope: {
      title: "Klarer Startfokus",
      intro: "Klarheit im Umfang stärkt Vertrauen.",
      bullets: [
        "Prishtina",
        "Fushë Kosovë",
        "Zum Start nur Wohnungen",
        "Ein fokussierter Service speziell für Wohnungen",
      ],
    },
    cta: {
      title: "Für den Anfang reicht ein ruhiges erstes Gespräch",
      description:
        "Sagen Sie uns, wo Sie leben, wo sich die Wohnung befindet und welche Unterstützung Sie brauchen.",
      primary: "Auf WhatsApp schreiben",
      secondary: "Information anfragen",
    },
    packagesPage: {
      introTitle: "Drei klare Pakete für die Wohnungsbetreuung in Prishtina und Fushë Kosovë",
      introBody:
        "Jedes Paket umfasst planmäßige Besuche, Zustandsprüfungen, Fotos und Updates für den Eigentümer. Die richtige Wahl hängt davon ab, wie oft die Wohnung besucht werden soll und wie viel Unterstützung Sie zwischen den Besuchen benötigen.",
      note: "Alle Besuche werden im Voraus geplant. Reparaturen, Teile, Materialien, Grundreinigung und Kosten externer Dienstleister werden separat berechnet. Startgebiet: Prishtina und Fushë Kosovë. Nur Wohnungen.",
      packages: [
        {
          name: "Essential Check",
          sixMonthPrice: "€450",
          twelveMonthPrice: "€840",
          sixMonthMonthly: "€75/Monat",
          twelveMonthMonthly: "€70/Monat",
          visits: "1 planmäßiger Besuch pro Monat",
          summary: "Grundlegende Sicherheit. Jemand prüft die Wohnung regelmäßig und Sie erhalten ein klares Update.",
          includes: [
            "1 planmäßiger Besuch pro Monat",
            "Sichtprüfung des Zustands",
            "Zugangs- und Bereitschaftsprüfung",
            "Prüfung von Türen, Fenstern und Grundzustand",
            "Prüfung auf sichtbare Feuchtigkeit, Lecks und Probleme",
            "Nützliche Fotos",
            "Kurzes Update nach jedem Besuch",
            "Problembenachrichtigung",
          ],
          excludes: "Reinigung, Reparaturen und unbegrenzte Koordination sind nicht enthalten.",
        },
        {
          name: "Care Plus",
          sixMonthPrice: "€720",
          twelveMonthPrice: "€1,320",
          sixMonthMonthly: "€120/Monat",
          twelveMonthMonthly: "€110/Monat",
          visits: "2 planmäßige Besuche pro Monat",
          summary: "Stärkere Betreuung. Häufigere Besuche, frühere Problemerkennung und praktische lokale Nachverfolgung.",
          includes: [
            "2 planmäßige Besuche pro Monat",
            "Alles aus Essential Check",
            "Update nach jedem Besuch",
            "Häufigere Problemerkennung",
            "Angemessene Problemnachverfolgung",
            "Grundlegende lokale Unterstützung für die Wohnung",
          ],
          excludes: "Unbegrenzte Koordination von Dienstleistern oder Projekten. Umfangreichere Arbeiten werden als Zusatzleistung berechnet.",
        },
        {
          name: "Arrival Ready",
          sixMonthPrice: "€990",
          twelveMonthPrice: "€1,890",
          sixMonthMonthly: "€165/Monat",
          twelveMonthMonthly: "€157.50/Monat",
          visits: "2 planmäßige Besuche pro Monat + Home Refresh",
          summary: "Vollständige Betreuung inklusive Ankunftsvorbereitung. Die Wohnung wird geprüft, gepflegt und vor Ihrer Rückkehr aufgefrischt.",
          includes: [
            "2 planmäßige Normalbesuche pro Monat",
            "Alles aus Care Plus",
            "1 enthaltenes Home Refresh pro 6-Monats-Laufzeit",
            "2 enthaltene Home Refreshes pro 12-Monats-Laufzeit",
            "Koordination der Ankunftsbereitschaft",
            "Home Refresh ist ein zusätzlicher physischer Besuch — ersetzt keinen normalen Besuch",
          ],
          excludes: "Grundreinigung, Reparaturen, Teile, Materialien und Kosten externer Dienstleister werden separat berechnet.",
        },
      ],
      exclusions: {
        title: "Was kein Paket stillschweigend enthält",
        items: [
          "Dienstleistergebühren",
          "Teile und Materialien",
          "Grundreinigung (sofern nicht separat vereinbart)",
          "Größere Reparaturen",
          "Unbegrenzte Besorgungen",
          "Unbegrenzte Dienstleisterkoordination",
          "Mietverwaltung",
          "Garantierter 24/7-Notdienst",
        ],
      },
    },
    servicesPage: {
      introTitle: "Zusätzliche Leistungen für Ihre Wohnung",
      introBody:
        "Über die wiederkehrenden Pakete hinaus kann STREHË bei spezifischen Projekten, Vorbereitungen und Instandhaltung helfen. Diese Leistungen sind vom monatlichen Besuchsrhythmus getrennt und werden einzeln angeboten oder bepreist.",
      categories: [
        {
          title: "Home Refresh",
          summary: "Eine leichte Auffrischung der Wohnung, um den Raum komfortabel und bereit für die Ankunft zu machen.",
          actions: [
            "Staubsaugen und normale Staubentfernung",
            "Abwischen grundlegender zugänglicher Oberflächen",
            "Grundlegende Küchen- und Badoberflächen zurücksetzen",
            "Lüften und Belüftung",
            "Sichtprüfung des Wohnungszustands",
            "Prüfung von Türen, Fenstern und Zugang",
            "Abschließendes Bereitschafts-Update",
          ],
          outcome: "Sie kommen in eine Wohnung, die sich frisch und gepflegt anfühlt — nicht grundgereinigt, aber bereit zur Nutzung.",
        },
        {
          title: "Malerarbeiten & Wandauffrischung",
          summary: "Wandausbesserungen, Raumstreichen oder Komplettstreichen der Wohnung.",
          actions: [
            "Wandausbesserungen und punktuelle Reparaturen",
            "Streichen eines einzelnen Raumes",
            "Mehrere Räume oder gesamte Wohnung",
            "Ab circa €2.50/m² Arbeit + Material",
            "Das endgültige Angebot hängt von Wandzustand, Vorbereitung, Anzahl der Anstriche, Möbelschutz und Materialien ab",
            "m² bedeutet die tatsächlich zu streichende Wand- und Deckenfläche, nicht die Wohnfläche",
          ],
          outcome: "Ihre Wohnung sieht frischer und gepflegter aus — ob für eine kleine Auffrischung oder einen kompletten Neuanstrich.",
        },
        {
          title: "Grundreinigung",
          summary: "Professionelle Intensivreinigung über den Umfang eines Home Refresh hinaus.",
          actions: [
            "Durch einen zugelassenen Reinigungspartner erbracht",
            "Anbieter- und Servicekosten werden separat angeboten",
            "Ideal vor der Ankunft, nach Renovierung oder für periodische Grundreinigung",
          ],
          outcome: "Eine gründliche professionelle Reinigung, die die Wohnung auf einen höheren Standard zurücksetzt.",
        },
        {
          title: "Reparaturen & Instandhaltung",
          summary: "Eine Kategorie für alle Reparatur- und Instandhaltungsbedürfnisse der Wohnung.",
          actions: [
            "Kleine sichere Reparaturen — Griffe, Scharniere, Armaturen",
            "Klempner, Elektriker, Schlosser",
            "Klimaanlagen- und Geräteprobleme",
            "Sonstige Wohnungsinstandhaltung",
            "Einfache sichere Arbeiten können direkt von STREHË ausgeführt werden",
            "Technische oder spezialisierte Arbeiten gehen an einen geeigneten Fachmann",
            "Teile, Materialien und Fachkosten bleiben separat",
          ],
          outcome: "Probleme werden erkannt, gemeldet und gelöst — ohne dass Sie lokale Handwerker aus dem Ausland verfolgen müssen.",
        },
        {
          title: "Modernisierung & Renovierungsunterstützung",
          summary: "Angebots- oder projektbasiert für größere Wohnungsarbeiten.",
          actions: [
            "Kosmetische Sanierung",
            "Möblierung und Möbelaufbau",
            "Streichenprojekte",
            "Austausch von Einrichtungsgegenständen",
            "Renovierungskoordination",
            "Dienstleisterüberwachung",
            "Vorbereitung einer älteren Wohnung für erneute Nutzung",
          ],
          outcome: "STREHË koordiniert, überwacht und berichtet. Spezialisierte Bauarbeiten werden von qualifizierten Fachleuten ausgeführt — nicht direkt von STREHË.",
        },
      ],
      note:
        "Jede Zusatzleistung wird einzeln angeboten oder bepreist. Reparaturen, Teile, Materialien und Kosten externer Dienstleister sind nicht in den monatlichen Paketpreisen enthalten.",
    },
    howPage: {
      introTitle: "Ein einfacher Ablauf, der Unsicherheit schon beim ersten Kontakt reduziert",
      introBody:
        "Der Service soll persönlich und gut organisiert wirken, nicht bürokratisch.",
      steps: [
        {
          title: "1. Sie kontaktieren uns",
          body: "Wir beginnen mit einem kurzen Gespräch per WhatsApp, Telefon oder E-Mail.",
        },
        {
          title: "2. Wir verstehen die Wohnung",
          body: "Wir klären, wo sie liegt, wie oft Sie abwesend sind und was Ihnen am wichtigsten ist.",
        },
        {
          title: "3. Wir vereinbaren das passende Setup",
          body: "Rhythmus und Umfang werden vor dem Start klar festgelegt.",
        },
        {
          title: "4. Die lokale Betreuung beginnt",
          body: "Besuche starten und klare Updates folgen.",
        },
      ],
      expectationsTitle: "Was Eigentümer erwarten sollten",
      expectations: [
        "Klare Kommunikation",
        "Sichtbare Nachverfolgung",
        "Einen Service passend zur Wohnung statt eines generischen Pakets",
        "Eine lokale Kontaktperson statt verstreuter informeller Hilfe",
      ],
      objectionsTitle: "Häufige Fragen",
      objections: [
        {
          question: "Was passiert, wenn etwas kaputtgeht?",
          answer: "Es sollte früh erkannt, klar erklärt und lokal nachverfolgt werden.",
        },
        {
          question: "Was ist bei dringendem Bedarf?",
          answer: "Der Service sollte schnelles Reagieren erleichtern, weil bereits ein lokaler Kontaktweg besteht.",
        },
        {
          question: "Was, wenn ich nicht zufrieden bin?",
          answer: "Die Zusammenarbeit sollte von Anfang an transparent, ruhig und verantwortungsvoll bleiben.",
        },
      ],
    },
    aboutPage: {
      introTitle: "Ein lokaler Service für Eigentümer, die ihre Wohnung aus dem Ausland nicht selbst im Blick behalten können",
      introBody:
        "STREHË soll Unsicherheit durch klare lokale Betreuung ersetzen. Es geht nicht darum, beeindruckend zu wirken. Es geht darum, Verantwortung vertrauensvoll zu übernehmen.",
      valuesTitle: "So arbeiten wir",
      values: [
        {
          title: "Fokussiert",
          body: "Der Startumfang bleibt bewusst eng, damit der Service glaubwürdig und diszipliniert bleibt.",
        },
        {
          title: "Verantwortlich",
          body: "Vertrauen entsteht durch Besuche, Updates und Nachverfolgung, nicht nur durch schöne Worte.",
        },
        {
          title: "Ruhig",
          body: "Der Service soll Eigentümer und Familien entlasten statt zusätzlichen Druck erzeugen.",
        },
      ],
      closing:
        "Für Eigentümer in der Diaspora zählt am Ende etwas Einfaches: eine verlässliche lokale Betreuung, die sich kümmert, während sie weg sind.",
    },
    contactPage: {
      introTitle: "Beginnen Sie mit einer einfachen Frage",
      introBody:
        "Sie brauchen keinen langen Prozess, um zu starten. Eine kurze Nachricht reicht, damit wir verstehen, ob der Service zu Ihrer Wohnung passt.",
      methodsTitle: "Die besten Kontaktwege",
      methods: [
        {
          title: "WhatsApp",
          description: "Am besten für einen schnellen ersten Austausch und möglichst zeitnahe Antworten.",
        },
        {
          title: "E-Mail",
          description: "Am besten, wenn Sie Ihre Situation etwas ausführlicher beschreiben möchten.",
        },
        {
          title: "Telefon",
          description: "Am besten für direkte oder dringende Gespräche.",
        },
      ],
      formTitle: "Information anfragen",
      formBody:
        "Senden Sie die wichtigsten Angaben, damit wir klar und passend antworten können.",
      formLabels: {
        name: "Name",
        contact: "E-Mail oder Telefon",
        abroad: "Leben Sie im Ausland?",
        country: "Land, in dem Sie leben",
        area: "Standort der Wohnung",
        message: "Nachricht",
        submit: "Anfrage senden",
      },
      formOptions: {
        yes: "Ja",
        no: "Nein",
      },
      helper:
        "Wir verwenden diese Angaben nur, um Ihre Anfrage zu verstehen und zu beantworten. Sie können uns auch direkt per E-Mail kontaktieren.",
      feedback: {
        submitting: "Wird gesendet...",
        fallback: "Per E-Mail senden",
      },
    },
    footer: {
      line: "Verlässliche lokale Betreuung für Wohnungen in Prishtina und Fushë Kosovë.",
      login: "Portal-Login",
    },
  },
};
