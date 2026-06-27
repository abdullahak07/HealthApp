const STORAGE_KEY = "healthai-mvp-v1";
const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.54/build/pdf.worker.min.mjs";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js";
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_PATTERN = DAY_NAMES.join("|");
const COLOURS = ["orange", "purple", "red", "cyan", "green", "pink", "slate"];

let statusElement;

function showStatus(message, tone = "working") {
  if (!statusElement) {
    statusElement = document.createElement("div");
    statusElement.setAttribute("role", "status");
    Object.assign(statusElement.style, {
      position: "fixed",
      right: "20px",
      bottom: "24px",
      zIndex: "10000",
      maxWidth: "430px",
      padding: "14px 16px",
      borderRadius: "12px",
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: "14px",
      fontWeight: "700",
      lineHeight: "1.45",
      color: "#f8fafc",
      boxShadow: "0 18px 50px rgba(0,0,0,.4)",
      transition: "opacity .2s ease",
    });
    document.body.appendChild(statusElement);
  }

  statusElement.textContent = message;
  statusElement.style.opacity = "1";
  statusElement.style.background = tone === "error"
    ? "#991b1b"
    : tone === "success"
      ? "#166534"
      : "#172033";
}

function hideStatus(delay = 3500) {
  window.setTimeout(() => {
    if (statusElement) statusElement.style.opacity = "0";
  }, delay);
}

function clean(value) {
  return String(value || "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || crypto.randomUUID();
}

function averageCalories(value) {
  const numbers = String(value || "").match(/\d+/g)?.map(Number) || [];
  if (!numbers.length) return 300;
  if (numbers.length === 1) return numbers[0];
  return Math.round((numbers[0] + numbers[1]) / 2);
}

function createDay({ day, focus, subtitle, duration, calories, warmup, cooldown, exercises, index, rest = false }) {
  const safeDay = DAY_NAMES.find((name) => name.toLowerCase() === clean(day).toLowerCase()) || clean(day) || `Day ${index + 1}`;
  return {
    id: `imported-${slug(safeDay)}-${index}`,
    day: safeDay,
    short: safeDay.slice(0, 3).toUpperCase(),
    focus: clean(focus) || (rest ? "Rest & Recovery" : "Imported Workout"),
    subtitle: clean(subtitle) || (rest ? "Recovery, mobility and sleep" : "Imported from uploaded routine"),
    duration: Number(duration) || (rest ? 0 : 60),
    estimatedCalories: Number(calories) || (rest ? 0 : 300),
    color: COLOURS[index % COLOURS.length],
    warmup: clean(warmup) || (rest ? "Easy movement only, as comfortable." : "5-10 minutes of easy cardio and movement preparation."),
    exercises: Array.isArray(exercises) ? exercises : [],
    cooldown: clean(cooldown) || "5 minutes of easy movement and comfortable stretching.",
    rest,
  };
}

function normaliseRoutine(routine) {
  const days = routine
    .filter(Boolean)
    .map((day, index) => createDay({ ...day, index }));

  if (!days.length || !days.some((day) => day.exercises.length > 0)) {
    throw new Error("No structured exercises could be detected in this file.");
  }

  if (!days.some((day) => day.day.toLowerCase() === "sunday")) {
    days.push(createDay({
      day: "Sunday",
      focus: "Rest & Recovery",
      subtitle: "Recovery supports training progress",
      duration: 0,
      calories: 0,
      warmup: "Easy movement only, as comfortable.",
      cooldown: "Prioritise sleep, hydration and recovery.",
      exercises: [],
      rest: true,
      index: days.length,
    }));
  }

  return days;
}

function groupPdfItems(items) {
  const groups = [];

  for (const item of items) {
    const text = clean(item.str);
    if (!text) continue;
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let line = groups.find((candidate) => Math.abs(candidate.y - y) <= 2.5);
    if (!line) {
      line = { y, items: [] };
      groups.push(line);
    }
    line.items.push({ text, x, width: Number(item.width || 0) });
  }

  return groups
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const sorted = line.items.sort((a, b) => a.x - b.x);
      return { ...line, items: sorted, text: clean(sorted.map((item) => item.text).join(" ")) };
    });
}

async function extractPdf(file) {
  showStatus(`Reading ${file.name} locally...`);
  const pdfjs = await import(/* @vite-ignore */ PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  if (pdf.numPages > 40) throw new Error("Please use a workout PDF with 40 pages or fewer.");

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    showStatus(`Reading PDF page ${pageNumber} of ${pdf.numPages}...`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({ pageNumber, lines: groupPdfItems(content.items) });
  }

  return {
    pages,
    text: pages.map((page) => page.lines.map((line) => line.text).join("\n")).join("\n\f\n"),
  };
}

async function extractImage(file) {
  showStatus(`Running private in-browser OCR on ${file.name}...`);
  const { createWorker } = await import(/* @vite-ignore */ TESSERACT_URL);
  const worker = await createWorker("eng", 1, {
    logger: (progress) => {
      if (progress.status === "recognizing text") {
        showStatus(`Reading image: ${Math.round((progress.progress || 0) * 100)}%`);
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    return clean(result.data.text).replace(/\s+(?=(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b)/gi, "\n");
  } finally {
    await worker.terminate();
  }
}

function lineLeftText(line, maximumX = 355) {
  return clean(line.items.filter((item) => item.x < maximumX).map((item) => item.text).join(" "));
}

function sectionText(lines, startPattern, endPattern) {
  const start = lines.findIndex((line) => startPattern.test(line.text));
  if (start < 0) return "";
  const endOffset = lines.slice(start + 1).findIndex((line) => endPattern.test(line.text));
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  const parts = [];

  const sameLine = lines[start].items.filter((item) => item.x > 105).map((item) => item.text);
  if (sameLine.length) parts.push(sameLine.join(" "));
  for (const line of lines.slice(start + 1, end)) {
    const value = lineLeftText(line, 540);
    if (value) parts.push(value);
  }
  return clean(parts.join(" "));
}

function parseExerciseRows(lines) {
  const tableStart = lines.findIndex((line) => /\bExercise\b/i.test(line.text) && /\bSets\b/i.test(line.text) && /\bReps\b/i.test(line.text));
  if (tableStart < 0) return [];
  const tableEndOffset = lines.slice(tableStart + 1).findIndex((line) => /COOL[- ]?DOWN|SAFETY NOTE/i.test(line.text));
  const tableEnd = tableEndOffset < 0 ? lines.length : tableStart + 1 + tableEndOffset;
  const body = lines.slice(tableStart + 1, tableEnd);
  const starts = [];

  body.forEach((line, index) => {
    if (line.items.some((item) => item.x < 70 && /^\d{1,2}$/.test(item.text))) starts.push(index);
  });

  const exercises = [];
  starts.forEach((start, position) => {
    const end = starts[position + 1] ?? body.length;
    const block = body.slice(start, end);
    const first = block[0];
    const numberItem = first.items.find((item) => item.x < 70 && /^\d{1,2}$/.test(item.text));
    const possibleSets = first.items.filter((item) => item.x > 150 && item.x < 280 && /^\d{1,2}$/.test(item.text));
    const setsItem = possibleSets[0];
    const restItem = first.items.find((item) => item.x > (setsItem?.x || 230) && /^(?:\d+\s*(?:s|sec|secs|seconds|min|mins|minutes)|active|-)$/i.test(item.text));

    if (!numberItem || !setsItem) return;

    const nameParts = first.items
      .filter((item) => item.x > numberItem.x + 8 && item.x < setsItem.x - 3)
      .map((item) => item.text)
      .filter((value) => value.toUpperCase() !== "NEW");

    for (const continuation of block.slice(1)) {
      const additions = continuation.items
        .filter((item) => item.x > numberItem.x + 8 && item.x < setsItem.x - 3)
        .map((item) => item.text)
        .filter((value) => value.toUpperCase() !== "NEW");
      nameParts.push(...additions);
    }

    const reps = clean(first.items
      .filter((item) => item.x > setsItem.x + 3 && (!restItem || item.x < restItem.x - 3))
      .map((item) => item.text)
      .join(" "));

    const name = clean(nameParts.join(" "));
    if (name) exercises.push([name, setsItem.text, reps || "As listed", restItem?.text || "60 sec"]);
  });

  return exercises;
}

function parsePdfPages(pages) {
  const parsed = [];
  const dayHeaderRegex = new RegExp(`\\bDAY\\s*\\d+\\s*(?:\\||-|:)\\s*(${DAY_PATTERN})\\b`, "i");

  for (const page of pages) {
    const pageText = page.lines.map((line) => line.text).join("\n");
    const dayMatch = pageText.match(dayHeaderRegex);
    if (!dayMatch) continue;

    const headerIndex = page.lines.findIndex((line) => dayHeaderRegex.test(line.text));
    const candidateLines = page.lines.slice(headerIndex + 1, headerIndex + 6);
    const focusLine = candidateLines.find((line) => {
      const value = lineLeftText(line);
      return value && !/^(primary|thickness|tummy|boulder|compound|biceps|estimated|\d+\s*min)/i.test(value);
    });
    const focus = focusLine ? lineLeftText(focusLine).replace(/\b\d+\s*min\b.*$/i, "") : "Imported Workout";
    const focusIndex = focusLine ? page.lines.indexOf(focusLine) : headerIndex;
    const subtitleLine = page.lines.slice(focusIndex + 1, focusIndex + 4).find((line) => {
      const value = lineLeftText(line);
      return value && !/SESSION|WARM[- ]?UP|Estimated|\d+\s*min/i.test(value);
    });

    const duration = Number(pageText.match(/\b(\d{2,3})\s*min\b/i)?.[1] || 60);
    const calorieRange = pageText.match(/Estimated\s+(\d+\s*[-–]\s*\d+)\s*kcal/i)?.[1] || "300";
    const exercises = parseExerciseRows(page.lines);

    parsed.push({
      day: dayMatch[1],
      focus,
      subtitle: subtitleLine ? lineLeftText(subtitleLine) : "Imported from PDF",
      duration,
      calories: averageCalories(calorieRange),
      warmup: sectionText(page.lines, /WARM[- ]?UP/i, /\bExercise\b.*\bSets\b|^#\b/i),
      cooldown: sectionText(page.lines, /COOL[- ]?DOWN/i, /SAFETY NOTE|Phase \d+ Workout Plan|Page \d+/i),
      exercises,
    });
  }

  return parsed;
}

function parseJson(text) {
  const value = JSON.parse(text);
  const routine = Array.isArray(value) ? value : value.routine;
  if (!Array.isArray(routine)) throw new Error("JSON must contain a routine array.");

  return routine.map((day) => ({
    ...day,
    exercises: (day.exercises || []).map((exercise) => Array.isArray(exercise)
      ? exercise.slice(0, 4)
      : [exercise.name, exercise.sets, exercise.reps, exercise.rest]),
  }));
}

function parseTextRoutine(text) {
  const source = String(text || "").replace(/\r/g, "");
  const headerRegex = new RegExp(`(?:^|\\n)(?:DAY\\s*\\d+\\s*(?:\\||-|:)\\s*)?(${DAY_PATTERN})\\b`, "gi");
  const matches = [...source.matchAll(headerRegex)];
  const sections = [];

  if (!matches.length) {
    sections.push({ day: "Monday", content: source });
  } else {
    matches.forEach((match, index) => {
      const start = match.index + match[0].length;
      const end = matches[index + 1]?.index ?? source.length;
      sections.push({ day: match[1], content: source.slice(start, end) });
    });
  }

  return sections.map((section, index) => {
    const lines = section.content.split("\n").map(clean).filter(Boolean);
    const exercises = [];
    for (const line of lines) {
      const numbered = line.match(/^\d+\s+(.+?)\s+(\d{1,2})\s+(.+?)\s+(\d+\s*(?:s|sec|secs|seconds|min|mins|minutes)|active|-)\b/i);
      const labelled = line.match(/^(.+?)\s*[-|:]\s*(\d{1,2})\s*(?:sets?|x)\s*[x×]?\s*(.+?)(?:\s*[-|,]\s*(\d+\s*(?:s|sec|secs|seconds|min|mins|minutes)))?$/i);
      const match = numbered || labelled;
      if (match) exercises.push([clean(match[1]), clean(match[2]), clean(match[3]), clean(match[4] || "60 sec")]);
    }

    const focus = lines.find((line) => !/^\d/.test(line) && !/warm|cool|session|exercise|sets|reps/i.test(line)) || "Imported Workout";
    return {
      day: section.day,
      focus,
      subtitle: "Imported from uploaded routine",
      duration: Number(section.content.match(/(\d{2,3})\s*min/i)?.[1] || 60),
      calories: averageCalories(section.content.match(/(\d+\s*[-–]\s*\d+)\s*kcal/i)?.[1] || "300"),
      warmup: section.content.match(/WARM[- ]?UP\s*[:|-]?\s*([^\n]+)/i)?.[1] || "",
      cooldown: section.content.match(/COOL[- ]?DOWN\s*[:|-]?\s*([^\n]+)/i)?.[1] || "",
      exercises,
      index,
    };
  }).filter((day) => day.exercises.length);
}

async function importRoutineFile(file) {
  if (file.size > 15 * 1024 * 1024) throw new Error("Please choose a file smaller than 15 MB.");

  let text = "";
  let routine = [];
  const lowerName = file.name.toLowerCase();

  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    const extracted = await extractPdf(file);
    text = extracted.text;
    routine = parsePdfPages(extracted.pages);
    if (!routine.some((day) => day.exercises.length)) routine = parseTextRoutine(text);
  } else if (file.type.startsWith("image/")) {
    text = await extractImage(file);
    routine = parseTextRoutine(text);
  } else {
    text = await file.text();
    routine = lowerName.endsWith(".json") ? parseJson(text) : parseTextRoutine(text);
  }

  const normalised = normaliseRoutine(routine);
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (!stored) throw new Error("Open HealthAI once before importing a routine.");

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    ...stored,
    routine: normalised,
    routineSource: `${file.name} · parsed locally`,
    importedRoutineText: text.slice(0, 50000),
    exerciseChecks: {},
  }));

  return normalised;
}

window.addEventListener("change", async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.closest(".upload-label")) return;
  const file = input.files?.[0];
  if (!file) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  try {
    const routine = await importRoutineFile(file);
    const exerciseCount = routine.reduce((sum, day) => sum + day.exercises.length, 0);
    showStatus(`Imported ${file.name}: ${routine.filter((day) => !day.rest).length} training days and ${exerciseCount} exercises. Reloading...`, "success");
    window.setTimeout(() => window.location.reload(), 1200);
  } catch (error) {
    console.error("Routine import failed", error);
    showStatus(`Could not import ${file.name}: ${error.message}`, "error");
    hideStatus(8000);
    input.value = "";
  }
}, true);
