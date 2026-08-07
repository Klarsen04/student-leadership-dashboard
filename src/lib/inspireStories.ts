// "Get Inspired" — a curated collection of short, encouraging reflective reads,
// modeled on PeacePod's get-inspired page (title + teaser + optional trigger
// warning + a longer body to read). Content here is original/paraphrased so
// nothing is copied from the source site.

export interface InspireStory {
  id: string;
  title: string;
  teaser: string;
  /** optional content/trigger warning shown as a small italic badge */
  tw?: string;
  emoji: string;
  /** soft gradient for the story's icon tile */
  accent: string;
  /** full body, shown when the reader opens the story */
  body: string[];
}

export const INSPIRE_STORIES: InspireStory[] = [
  {
    id: "recovery",
    title: "What my hard year taught me",
    teaser: "A look back on a difficult chapter — and the small things that carried me through.",
    tw: "mentions of an eating disorder",
    emoji: "🪐",
    accent: "from-orange-300 to-rose-300",
    body: [
      "For a long time I measured my worth in numbers — grades, weight, the count of people who seemed to approve of me.",
      "Recovery didn't arrive as a single moment. It came as a hundred ordinary choices: eating breakfast, texting a friend back, letting myself rest without guilt.",
      "If you're in the middle of a hard year, you don't have to see the whole staircase. Just take the step in front of you. That's enough for today.",
    ],
  },
  {
    id: "true-beauty",
    title: "True beauty is a quiet kind of confidence",
    teaser: "What I learned talking to someone who chases growth instead of perfection.",
    emoji: "🦋",
    accent: "from-sky-300 to-violet-300",
    body: [
      "The people I find most beautiful aren't the ones who look flawless — they're the ones who are fully themselves in the room.",
      "Confidence isn't the absence of doubt. It's showing up anyway, and being kind to yourself when you stumble.",
      "You are allowed to take up space, to have opinions, to be a work in progress. That's not a flaw. That's what being alive looks like.",
    ],
  },
  {
    id: "depression",
    title: "I didn't know that was what it looked like",
    teaser: "A personal piece on noticing when 'just sad' is something heavier — and asking for help.",
    tw: "mentions of depression",
    emoji: "☕",
    accent: "from-emerald-300 to-teal-300",
    body: [
      "I thought depression looked like crying all the time. For me it looked like nothing — a grey flatness where things I used to love stopped mattering.",
      "Naming it was the hardest and most important step. Once I could say 'this is depression, not the truth about me,' I could start reaching for help.",
      "If this sounds familiar: please tell someone you trust. You deserve support, and you are not a burden for needing it.",
    ],
  },
  {
    id: "songs",
    title: "Songs that got me through",
    teaser: "Sometimes the right song at the right moment says what you can't.",
    emoji: "🎧",
    accent: "from-amber-300 to-pink-300",
    body: [
      "There are songs that feel like they were written from inside your own head — proof that someone, somewhere, felt this too.",
      "Music won't fix everything, but it can hold you for three and a half minutes until the wave passes.",
      "Make the playlist. Name it something hopeful. Future-you will be grateful you did.",
    ],
  },
  {
    id: "bravery",
    title: "The bravery to break free",
    teaser: "On outgrowing the version of yourself that no longer fits.",
    emoji: "🌅",
    accent: "from-rose-300 to-amber-300",
    body: [
      "Growth often feels like loss at first — leaving behind habits, spaces, or relationships that once felt like home.",
      "Being brave doesn't mean being fearless. It means letting the fear ride shotgun while you keep driving toward something better.",
      "You are allowed to change your mind, to start over, to choose yourself. That is not selfish. That is survival, and then it is freedom.",
    ],
  },
];
