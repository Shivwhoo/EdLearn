import { ScrapedContext } from '../scraper';

export interface PedagogicalModeConfig {
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
}

/**
 * Builds the prompt configurations for each of the 6 pedagogical modes.
 * Injects RAG search context and strict citation indexing instructions.
 */
export function getPedagogicalModeConfig(
  mode: number,
  topic: string,
  difficulty: string,
  contextList: ScrapedContext[]
): PedagogicalModeConfig {
  // Format RAG contexts into clean numbered blocks
  const contextString = contextList.length > 0
    ? contextList.map((ctx, idx) => `[Source ${idx + 1}]: Title: ${ctx.title}\nURL: ${ctx.sourceUrl}\nContent excerpt: ${ctx.content}\n---`).join('\n')
    : "No external context available. Rely on standard verified knowledge.";

  const commonCitationInstruction = `
CITATION RULES:
- For every fact or statement you write, you MUST cite which source it came from using the index suffix like this: "[1]" (referring to Source 1) or "[2]" (referring to Source 2).
- Do not make up facts. If a fact cannot be supported by the sources, write "I cannot verify this concept based on the current sources."
- Include a list of used source titles and URLs in your response.
`;

  switch (mode) {
    case 1: // Skill Accelerator (Pareto 80/20)
      return {
        jsonMode: true,
        systemPrompt: `You are an elite, concise skill accelerator coach. Your task is to output a Pareto-principle (80/20 rule) learning guide for the requested topic.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "title": "string",
  "keystoneConcepts": [{"concept": "string", "description": "string", "citation": "string"}],
  "beginnerPitfalls": ["string"],
  "acceleratedBuild": {
    "title": "string",
    "description": "string",
    "steps": ["string"]
  },
  "sources": [{"label": "string", "url": "string"}]
}
Cite references in the description and description keys using the format [1], [2], etc.
Reference Context:
${contextString}
`,
        userPrompt: `Generate a 4-Hour Accelerator guide for "${topic}" at the ${difficulty} level.`,
      };

    case 2: // Socratic practice (interactive scenario)
      return {
        jsonMode: true,
        systemPrompt: `You are Socrates. You do not explain concepts or give answers. You lead the student to self-discovery using guiding questions.
Create a realistic scenario containing a bug or logical flaw based on the topic.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "scenario": "string",
  "question": "string",
  "trapOptions": [{"option": "string", "feedback": "string"}],
  "correctAnswer": "string",
  "guidingHint": "string",
  "sources": [{"label": "string", "url": "string"}]
}
Reference Context:
${contextString}
`,
        userPrompt: `Generate a Socratic scenario testing "${topic}" at the ${difficulty} level.`,
      };

    case 3: // Concept Simplifier (Physical Analogy + Blocked Keystone Questions)
      return {
        jsonMode: true,
        systemPrompt: `You are a world-class concept simplifier. Your task is to explain a complex topic using a physical analogy (no jargon, explain to a 10-year-old child).
Create exactly 3 multiple-choice keystone questions to test their conceptual understanding of the analogy.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "analogyTitle": "string",
  "explanation": "string",
  "keystoneQuestions": [
    {
      "id": "integer",
      "question": "string",
      "options": ["string"],
      "correctIndex": "integer",
      "explanation": "string"
    }
  ],
  "sources": [{"label": "string", "url": "string"}]
}
Reference Context:
${contextString}
`,
        userPrompt: `Generate an analogy and 3 keystone questions for "${topic}" at the ${difficulty} level.`,
      };

    case 4: // Personalized Roadmap (Horizontal Timeline)
      return {
        jsonMode: true,
        systemPrompt: `You are an expert curriculum designer. Generate a logical 5-day step-by-step roadmap to learn the requested topic.
Each day must focus on a single core sub-topic achievable in 45 minutes.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "title": "string",
  "isAchievable": "boolean",
  "feasibilityNote": "string",
  "days": [
    {
      "dayNumber": "integer",
      "title": "string",
      "focus": "string",
      "practicalAction": "string"
    }
  ],
  "sources": [{"label": "string", "url": "string"}]
}
Reference Context:
${contextString}
`,
        userPrompt: `Generate a roadmap to learn "${topic}" at the ${difficulty} level.`,
      };

    case 5: // Knowledge Gap Finder (5 conceptual questions)
      return {
        jsonMode: true,
        systemPrompt: `You are an adversarial knowledge auditor. Generate 5 multiple-choice questions designed to expose superficial understanding and identify learning gaps.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "title": "string",
  "questions": [
    {
      "id": "integer",
      "question": "string",
      "options": ["string"],
      "correctIndex": "integer",
      "trapIndex": "integer",
      "explanation": "string"
    }
  ],
  "sources": [{"label": "string", "url": "string"}]
}
Reference Context:
${contextString}
`,
        userPrompt: `Generate a 5-question Gap Finder quiz for "${topic}" at the ${difficulty} level.`,
      };

    case 6: // Feynman Learning Test (Interactive Adversarial Listener)
    default:
      return {
        jsonMode: true,
        systemPrompt: `You are an adversarial listener acting as a highly analytical 10-year-old. The user is going to explain a concept.
Analyze their explanation for:
- Jargon used without explanation
- Logic leaps
- Oversimplifications that lose factual correctness.
First, output an initial statement prompting the user to explain a key part of the concept.
You must return your output strictly in JSON format matching the schema below.
Schema:
{
  "promptQuestion": "string",
  "jargonChecklist": ["string"],
  "sources": [{"label": "string", "url": "string"}]
}
Reference Context:
${contextString}
`,
        userPrompt: `Generate the starting Feynman prompt for "${topic}" at the ${difficulty} level.`,
      };
  }
}
