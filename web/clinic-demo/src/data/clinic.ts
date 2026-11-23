export const CLINIC = {
  name: "AUREL Aesthetics",
  tagline: "Refine Your Profile. Reveal Your Confidence.",
  address: "Placeholder address · Fictional clinic",
};

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
    body: "A guided camera scan from five angles builds a 3D model of your profile, right in your browser. Nothing is uploaded.",
  },
  {
    n: "02",
    title: "Explore",
    body: "Turn your own profile in 3D, side by side with an identical copy, from the front, side or three-quarter view.",
  },
  {
    n: "03",
    title: "Customize",
    body: "Optionally move gentle, illustrative sliders on the copy to put words to what you are curious about. Your original never changes.",
  },
  {
    n: "04",
    title: "Consult",
    body: "Bring your ideas to a surgeon, who explains what is realistic, safe and right for your face, including doing nothing.",
  },
];
