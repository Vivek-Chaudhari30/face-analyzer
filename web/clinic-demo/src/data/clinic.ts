export const CLINIC = {
  name: "AUREL Aesthetics",
  tagline: "Refine Your Profile. Reveal Your Confidence.",
  address: "Placeholder address · Fictional clinic",
};

export interface Service {
  id: string;
  title: string;
  blurb: string;
}

/** Values double as the "Service of interest" options on the booking form. */
export const SERVICES: Service[] = [
  {
    id: "rhinoplasty",
    title: "Rhinoplasty consultation",
    blurb: "A considered conversation about the shape, balance and function of your nose.",
  },
  {
    id: "revision",
    title: "Revision rhinoplasty consultation",
    blurb: "A careful review for those who have had a previous nasal procedure and want to talk through options.",
  },
  {
    id: "harmony",
    title: "Facial harmony assessment",
    blurb: "A whole-face view of proportion, so that any change to one feature is judged in context.",
  },
  {
    id: "general",
    title: "General aesthetic consultation",
    blurb: "An unhurried introduction to the clinic, the team, and what to expect.",
  },
];

export interface TeamMember {
  name: string;
  role: string;
  focus: string;
  bio: string;
  initials: string;
  tone: string;
}

/** Entirely fictional. Do not present these as real clinicians. */
export const TEAM: TeamMember[] = [
  {
    name: "Dr. Isabelle Laurent",
    role: "Lead Facial Plastic Surgeon",
    focus: "Primary rhinoplasty",
    bio: "A fictional surgeon created for this demonstration. Her illustrative philosophy: restraint first, and a result that looks like you.",
    initials: "IL",
    tone: "from-[#e9dcc6] to-[#c9b48f]",
  },
  {
    name: "Dr. Marcus Whitfield",
    role: "Consulting Surgeon",
    focus: "Revision rhinoplasty",
    bio: "A fictional profile. Illustrates how a clinic might introduce a surgeon who focuses on careful revision work.",
    initials: "MW",
    tone: "from-[#d9cdb8] to-[#a99a80]",
  },
  {
    name: "Dr. Naomi Sato",
    role: "Director of Facial Harmony",
    focus: "Proportion and planning",
    bio: "A fictional profile. Illustrates a planning-focused role that reviews the face as a whole before any decision is made.",
    initials: "NS",
    tone: "from-[#efe4d0] to-[#d6c1a0]",
  },
];

export const PROCESS = [
  {
    n: "01",
    title: "Scan",
    body: "A brief, private face scan on a compatible phone captures your profile as a 3D model in minutes.",
  },
  {
    n: "02",
    title: "Explore",
    body: "Rotate your own profile and try gentle, illustrative adjustments, so you can put words to what you are curious about.",
  },
  {
    n: "03",
    title: "Consult",
    body: "Bring those ideas to a surgeon. Together you discuss what is realistic, safe, and right for your face.",
  },
];
