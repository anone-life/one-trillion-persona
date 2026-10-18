# Why these layers

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/layers-dark.svg">
  <img alt="One inner life (Bazi) surrounded by seven outer layers: World, Body, Skills, Standing, Signs, Drama, Quirk" src="assets/layers-light.svg">
</picture>

A character in One-Trillion Persona has **one inner life and seven outer layers**. This page explains why the person is split that way, which ideas from personality psychology each layer borrows, and what we are *not* claiming.

The short version: most character cards describe a person with adjectives. Adjectives don't survive contact with a language model. The model's own personality absorbs them, and twenty messages later every character sounds the same. We describe a person instead with **things that act**: motives that pull against each other, behavior that changes with the situation, and outer facts that are specific enough to picture.

## 0. The problem we started from

We went through every post in r/SillyTavernAI from 2025-10-17 to 2026-10-16: 13,054 posts, from the Arctic Shift archive. A model sorted each one, and a person spot-checked the sorting (83% correct on 178 posts; the 921 posts about the model were sorted again into three groups, 82% correct on 60). 2,690 posts complain about how chats with characters turn out:

| What people complain about | Posts | Share | Who fixes it |
|---|---|---|---|
| The model got worse, or broke | 324 | 12% | Not us (model and provider) |
| Refuses and censors | 306 | 11% | Partly anone.life: open models chosen for role-play refuse far less (but a third of these posts are about open models). Adults only (18+); never minors |
| Doesn't play the prompt: breaks character, speaks for you, too positive | 291 | 11% | Partly 1T Persona: it writes the character's part of the prompt as rules a model can follow |
| Stock phrases and repetition | 286 | 11% | Partly 1T Persona (rules of speech; not yet measured) |
| Too hard to set up and tune | 278 | 10% | 1T Persona (runs in the browser) + anone.life (open the site and talk) |
| They forget | 244 | 9% | anone.life (1T Persona keeps only the last 30 messages, on purpose) |
| Every character sounds the same, and agrees too easily | 192 | 7% | **1T Persona**: this page is about that |
| Too expensive: tokens burn too fast | 160 | 6% | Not us, and 1T Persona makes it a little worse: its cards are ~4K tokens on every reply |
| Good characters are hard to find, or to write | 93 | 3% | **1T Persona**: a seed plus a few lines of chat |
| No face, no voice | 19 | 1% | anone.life |
| Passive: they never take the lead | 19 | 1% | 1T Persona (wants that drive them) + anone.life (messages you first) |
| None of the above | 478 | 18% | |

Three things stand out:

- **64%** of the complaints are things 1T Persona and anone.life fix, fully or in part. Only 18% is truly out of our hands.
- **A third of the "blame the model" posts are really prompt problems** (291 of 921): breaking character, speaking for the user, being too nice. That's the part of the prompt 1T Persona writes.
- **Refusals nearly doubled**, from 6.7% to 12.5% of complaints, comparing the first three months with the last nine. anone.life runs on open models, for adults only.

This counts people who post, not every player. Rerun it with `tools/st_pain_survey.ts`.

## 1. Inside and outside are separate

The person is split into two halves that never derive from each other:

| | Layer | What it decides | Count |
|---|---|---|---|
| **Inside** | Inner life (Bazi) | What they want, what wanting it costs, what breaks them, and how they are in four settings | 518,400 charts |
| **Outside** | World | Era, city, social rules, economy | 3,072 |
| | Body | Form, looks (always 18+), how they present, voice | 768 |
| | Skills | Main skill, second skill, whether the skill is real | 768 |
| | Standing | Class, fame, legal record, household | 400 |
| | Signs | Style, way of talking, where they're usually found | 576 |
| | Drama | Role in the story, the secret they keep, how much they can change the story | 192 |
| | Quirk | One small unexplained habit | 63 |

**Rule: the chart never decides the outside.** It can't pick a city, a job, a face, an ethnicity or an orientation. Each outer layer is drawn from its own random stream, so you can pin or change one layer and nothing else moves (`spec/bazi-rules.v1.md` §5–6).

This follows McAdams and Pals' integrative framework of personality ("a new Big Five"). That framework treats a person as several distinct levels: dispositional traits, *characteristic adaptations* (goals, motives, values), *life narratives*, and the culture and body they live in. These levels are related, but you can't read one off another. Our layers map onto them:

| Our layer | Level it borrows from |
|---|---|
| Inner life: wants / price / breaks | Characteristic adaptations: motives and goals |
| World | Culture and historical context |
| Body | Embodiment |
| Skills, Standing | Social roles and position |
| Signs | Self-presentation: how a person performs themselves for others (Goffman) |
| Drama, secret | Narrative identity: the story a person tells about themselves (McAdams & McLean) |
| Quirk | Idiographic detail: what belongs to this one person only (Allport) |

## 2. Four faces: consistency lives in "if… then…"

People don't behave the same everywhere. Mischel and Shoda's *cognitive-affective personality system* (CAPS) treats that variation as part of personality itself. What stays stable is a person's **if–then signature**: in situation A they do X, in situation B they do Y. Fleeson's experience-sampling studies show the same thing from another angle. A person's moment-to-moment states vary widely, but the *distribution* of those states is stable and differs between people.

So instead of labelling a character "introverted", each one gets:

- **four faces**: with strangers, at work, up close, deep down;
- **five to eight if–then rules**: *when this happens → they do this, because…*, including situations where they **refuse** or push back.

This is how a character can be inconsistent in a way that still makes sense: warm in public and argumentative in private, for reasons you can trace.

## 3. One motive, two sides

The inner life gives each character a **want**, the **price** of wanting it, and the situation that would **break** them. All three come from the same source. The motive that drives them is also the thing that costs them, and pushing it too far is what breaks them.

That keeps the character from contradicting itself: the tension is built in, not bolted on. It also gives the model something to do besides agreeing with you. This motive structure is the part of the design we consider strongest. It is also what our planned comparisons are meant to test (§6).

## 4. Why Bazi for the inner life

The inner life uses the Four Pillars (Bazi) calendar as a **grammar for describing relational motives**. It is not a measurement of anyone.

- **It describes relationships, not traits.** Bazi's *Ten Gods* name how the self relates to everything else: what nourishes it, what constrains it, what it wants to control, and what it needs to express. Cheung and colleagues' work on Chinese personality (the CPAI) found an **interpersonal relatedness** dimension that the Big Five doesn't cover. Bazi gives us a native, compact vocabulary for exactly that kind of motive.
- **The four pillars map naturally onto four settings.** Year → how they meet strangers, month → work, day → up close, hour → what they want deep down.
- **A birthday is a natural seed.** It gives a reproducible way to ask "who would someone born at this moment be?"
- **It's familiar.** Players in China, Japan and Korea already have this vocabulary (八字, 四柱推命, 사주), and language models have read a great deal about it, so a few terms carry a lot of meaning.

Every step of the translation is fixed and public:

- the calendar rules (solar terms, the 23:00 day boundary, no daylight saving time);
- the creative weights;
- the Ten God → want / price / break table;
- the four-face lines.

See `spec/bazi-rules.v1.md` and `spec/translation.v1.json`. Chart calculation is checked against an independent library on 10,000 random moments.

## 5. Layers constrain each other

Outer layers are drawn independently but checked against each other, so a random person still fits a story. A few examples: no virtual idols before the internet era, no abundance in wartime, no Y2K fashion in the Late Qing. When a combination breaks a rule, the later layer is redrawn (`spec/constraints.v1.json`).

How big the space is, after constraints:

| Scope | Valid combinations | For scale |
|---|---|---|
| Bazi × World × Body (the name) | 1.07 × 10¹² | one trillion |
| The seven outer layers alone | 4.19 × 10¹⁸ | roughly the grains of sand on Earth |
| All eight layers | 2.17 × 10²⁴ | roughly the stars in the observable universe |

Constraints remove about 17% of the outer combinations. "One trillion" is the name; 10²⁴ is the scale. The tests recount the three-layer number on every run.

## 6. What we are not claiming

- **Bazi does not predict real people.** Direct studies of Four Pillars and personality are few, small and mixed. Jung & Yang (2015) found weak, null and partly opposite associations. And "it feels accurate" is not evidence (Forer). We use Bazi to *write fiction*, and nothing in this project says anything about the user's own personality.
- **The psychology mappings are design analogies, not validations.** CAPS, McAdams and Fleeson explain why the structure is shaped the way it is. They don't prove that this generator produces better characters.
- **Combinations are addresses, not proven-different people.** Two seeds can play out similarly. Persona Hub has already generated a billion personas, so scale on its own isn't the point.
- **Whether Bazi beats other structures is an open question.** The planned test runs the same character pipeline three ways: once with the Bazi layer, once with a Big Five + motives layer of matched size, and once with a random relational graph. Each version gets blind ratings on unseen scenes. If Bazi doesn't outperform the other two, the structure still stands, but we will say so here.

## References

1. Mischel, W., & Shoda, Y. (1995). A cognitive-affective system theory of personality: Reconceptualizing situations, dispositions, dynamics, and invariance in personality structure. *Psychological Review, 102*(2), 246–268.
2. McAdams, D. P., & Pals, J. L. (2006). A new Big Five: Fundamental principles for an integrative science of personality. *American Psychologist, 61*(3), 204–217.
3. Fleeson, W., & Gallagher, P. (2009). The implications of Big Five standing for the distribution of trait manifestation in behavior: Fifteen experience-sampling studies and a meta-analysis. *Journal of Personality and Social Psychology, 97*(6), 1097–1114.
4. Cheung, F. M., Leung, K., Zhang, J.-X., et al. (2001). Indigenous Chinese personality constructs: Is the five-factor model complete? *Journal of Cross-Cultural Psychology, 32*(4), 407–433.
5. McAdams, D. P., & McLean, K. C. (2013). Narrative identity. *Current Directions in Psychological Science, 22*(3), 233–238.
6. Goffman, E. (1959). *The Presentation of Self in Everyday Life.* Doubleday.
7. Allport, G. W. (1937). *Personality: A Psychological Interpretation.* Holt.
8. Jung, S. A., & Yang, C. S. (2015). Relations between Eastern Four Pillars Theory and Western measures of personality traits. *Yonsei Medical Journal, 56*(3), 698–704.
9. Forer, B. R. (1949). The fallacy of personal validation: A classroom demonstration of gullibility. *Journal of Abnormal and Social Psychology, 44*(1), 118–123.
10. Ge, T., et al. (2024). Scaling synthetic data creation with 1,000,000,000 personas. arXiv:2406.20094.

The diagram is generated by `tools/gen_layers_diagram.py`. Edit that script rather than the SVGs.
