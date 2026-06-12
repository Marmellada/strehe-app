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
    servicesPage: {
      introTitle: "Practical support for apartments that need local care while you are abroad",
      introBody:
        "We do not present a random list of tasks. We organize services around what an owner actually needs in order to feel informed, prepared, and supported.",
      categories: [
        {
          title: "Recurring apartment checks",
          summary: "Regular visits that help you know the apartment is being looked after.",
          actions: [
            "Visit the apartment on an agreed rhythm",
            "Check visible condition, access, and readiness",
            "Flag concerns early before they grow",
          ],
          outcome: "You receive a clear update after visits.",
        },
        {
          title: "Arrival-ready preparation",
          summary: "Support before you or your family arrive.",
          actions: [
            "Check the apartment before your return",
            "Air out and prepare the space when needed",
            "Coordinate practical readiness tasks",
          ],
          outcome: "You arrive to a place that feels cared for, not neglected.",
        },
        {
          title: "Issue follow-up and small-fix coordination",
          summary: "Local follow-up when something needs attention.",
          actions: [
            "Report issues clearly",
            "Contact the right local provider when needed",
            "Follow up until the matter is resolved",
          ],
          outcome: "You do not have to chase local details from abroad.",
        },
        {
          title: "Practical owner support",
          summary: "The small local tasks that are difficult to handle from another country.",
          actions: [
            "Coordinate practical errands when appropriate",
            "Support utility and apartment-related follow-up",
            "Keep communication organized",
          ],
          outcome: "You get one calmer and more structured local setup.",
        },
      ],
      note:
        "The exact visit rhythm and scope are agreed before service begins. Repairs or outside-provider costs are always discussed separately.",
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
      secondaryCta: "Shihni si funksionon",
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
      title: "Çfarë bëjmë për apartamentin tuaj",
      intro: "Kontrollojmë. Dokumentojmë. Ndjekim.",
      items: [
        {
          title: "Kontrolle të rregullta të apartamentit",
          description: "Ne vizitojmë, kontrollojmë gjendjen dhe ju njoftojmë qartë.",
        },
        {
          title: "Përgatitje para ardhjes",
          description: "Ndihmojmë që apartamenti të jetë gati para kthimit tuaj.",
        },
        {
          title: "Raportim i problemeve dhe ndjekje",
          description: "Nëse ka diçka për t'u rregulluar, e zbulojmë herët dhe e ndjekim lokalisht.",
        },
        {
          title: "Koordinim praktik lokal",
          description: "Merremi me detajet e vogla por të rëndësishme që është vështirë t'i menaxhoni nga jashtë.",
        },
      ],
    },
    trust: {
      title: "Besimi ndërtohet me prova, jo me premtime",
      intro:
        "Çdo vizitë ka një qëllim, një raport dhe një person përgjegjës për hapat e ardhshëm.",
      items: [
        "Zonë e fokusuar shërbimi, jo premtime të paqarta në gjithë vendin",
        "Vetëm apartamente në fillim që shërbimi të mbetet i disiplinuar",
        "Vizita të rregullta me përditësime të qarta",
        "Një pikë lokale kontakti për ndjekje",
        "Shërbim i strukturuar, jo favor i improvizuar",
      ],
    },
    process: {
      title: "Si funksionon",
      intro: "Nga mesazhi i parë te raporti pas vizitës.",
      steps: [
        {
          title: "Na kontaktoni",
          description: "Fillojmë me një bisedë të shkurtër për apartamentin dhe nevojat tuaja.",
        },
        {
          title: "E kuptojmë situatën",
          description: "Sqarojmë çfarë është më e rëndësishme, çfarë duhet kontrolluar dhe sa shpesh.",
        },
        {
          title: "Dakordohemi për mbështetjen e duhur",
          description: "Shërbimi mbetet praktik dhe i përshtatur për apartamentin tuaj.",
        },
        {
          title: "Fillojmë vizitat dhe përditësimet",
          description: "Pas vizitave, ju merrni njoftime të qarta në vend të pasigurisë.",
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
      secondary: "Kërkoni informata",
    },
    servicesPage: {
      introTitle: "Mbështetje praktike për apartamente që kanë nevojë për kujdes lokal ndërsa ju jeni jashtë",
      introBody:
        "Ne nuk paraqesim një listë të rastësishme punësh. Shërbimet organizohen sipas asaj që i duhet realisht një pronari për t'u ndier i informuar dhe i qetë.",
      categories: [
        {
          title: "Kontrolle të rregullta",
          summary: "Vizita të rregullta që ju ndihmojnë të dini se apartamenti po mbahet nën kujdes.",
          actions: [
            "Vizitë sipas ritmit të dakorduar",
            "Kontroll i gjendjes së dukshme, qasjes dhe gatishmërisë",
            "Shenjim i hershëm i shqetësimeve",
          ],
          outcome: "Ju merrni përditësim të qartë pas vizitave.",
        },
        {
          title: "Përgatitje para ardhjes",
          summary: "Ndihmë para kthimit tuaj ose të familjes.",
          actions: [
            "Kontroll para kthimit",
            "Ajrosje dhe përgatitje kur nevojitet",
            "Koordinim i detajeve praktike",
          ],
          outcome: "Ktheheni në një hapësirë që ndihet e mbajtur, jo e lënë pas dore.",
        },
        {
          title: "Ndjekje e problemeve dhe koordinim i riparimeve të vogla",
          summary: "Ndjekje lokale kur diçka kërkon vëmendje.",
          actions: [
            "Raportim i qartë i problemit",
            "Kontaktim i ofruesit të duhur lokal",
            "Ndjekje deri në zgjidhje",
          ],
          outcome: "Nuk keni nevojë të ndiqni detajet lokale nga jashtë.",
        },
        {
          title: "Mbështetje praktike për pronarin",
          summary: "Detajet lokale që është vështirë t'i menaxhoni nga një shtet tjetër.",
          actions: [
            "Koordinim i çështjeve praktike kur është e arsyeshme",
            "Ndjekje e utility-ve ose çështjeve të apartamentit",
            "Komunikim i organizuar",
          ],
          outcome: "Ju fitoni një rregullim më të qetë dhe më të strukturuar lokal.",
        },
      ],
      note:
        "Ritmi i vizitave dhe fushëveprimi dakordohen para fillimit. Riparimet ose kostot e ofruesve të jashtëm diskutohen gjithmonë veçmas.",
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
    servicesPage: {
      introTitle: "Praktische Unterstützung für Wohnungen, die lokale Betreuung brauchen, während Sie im Ausland sind",
      introBody:
        "Wir zeigen kein ungeordnetes Aufgabenmenü. Die Leistungen sind so aufgebaut, wie Eigentümer sie wirklich brauchen, um informiert und entlastet zu sein.",
      categories: [
        {
          title: "Regelmäßige Wohnungschecks",
          summary: "Regelmäßige Besuche, damit Sie wissen, dass sich jemand kümmert.",
          actions: [
            "Besuche im vereinbarten Rhythmus",
            "Prüfung von sichtbarem Zustand, Zugang und Bereitschaft",
            "Frühes Erkennen möglicher Probleme",
          ],
          outcome: "Sie erhalten nach Besuchen ein klares Update.",
        },
        {
          title: "Vorbereitung vor Ihrer Anreise",
          summary: "Unterstützung vor Ihrer Rückkehr oder der Rückkehr Ihrer Familie.",
          actions: [
            "Kontrolle vor der Anreise",
            "Lüften und Vorbereiten bei Bedarf",
            "Koordination praktischer Details",
          ],
          outcome: "Sie kommen in eine Wohnung zurück, die gepflegt wirkt und nicht vernachlässigt.",
        },
        {
          title: "Problemnachverfolgung und Koordination kleiner Reparaturen",
          summary: "Lokale Nachverfolgung, wenn etwas Aufmerksamkeit braucht.",
          actions: [
            "Klare Problemmeldung",
            "Kontakt mit passenden lokalen Dienstleistern",
            "Nachverfolgung bis zur Klärung",
          ],
          outcome: "Sie müssen lokale Details nicht aus dem Ausland hinterherlaufen.",
        },
        {
          title: "Praktische Eigentümerunterstützung",
          summary: "Die kleinen lokalen Aufgaben, die aus einem anderen Land schwer zu steuern sind.",
          actions: [
            "Koordination praktischer Anliegen, wenn sinnvoll",
            "Unterstützung bei wohnungsbezogenen Themen",
            "Geordnete Kommunikation",
          ],
          outcome: "Sie erhalten ein ruhigeres und besser organisiertes lokales Setup.",
        },
      ],
      note:
        "Besuchsrhythmus und Leistungsumfang werden vor dem Start vereinbart. Reparaturen oder Kosten externer Dienstleister werden immer separat abgestimmt.",
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
