export interface ScreeningQuestionShape {
  prompt: string;
  type: 'yes_no' | 'short_text' | 'multi_select';
  options?: string[];
  required?: boolean;
}

export type QuestionnaireResponses = {
  version: 1;
  responses: Array<{ prompt: string; answer: string | string[] }>;
};

export function parseQuestionnaireFromForm(
  form: FormData,
  questions: ScreeningQuestionShape[],
): QuestionnaireResponses {
  const responses: QuestionnaireResponses['responses'] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    let answer: string | string[];
    if (q.type === 'multi_select') {
      answer = form.getAll(`screening[${i}]`).map(String);
    } else {
      answer = String(form.get(`screening[${i}]`) ?? '').trim();
    }
    responses.push({ prompt: q.prompt, answer });
  }
  return { version: 1, responses };
}

export function questionnaireToSummary(payload: QuestionnaireResponses): string {
  return payload.responses
    .map((r, i) => {
      const v = Array.isArray(r.answer) ? r.answer.join(', ') : r.answer;
      return `${i + 1}. ${r.prompt}\n   → ${v}`;
    })
    .join('\n\n');
}
