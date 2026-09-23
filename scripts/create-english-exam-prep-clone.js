require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const { MongoClient, ObjectId } = require("mongodb");

const SOURCE_TITLES = ["הכנה למבחן", "תרגיל הכנה למבחן"];
const ENGLISH_SET_TITLE = "Exam Prep - English Screenshot";
const ENGLISH_DATASET_NAME = "Exam Prep - Debate Competition Dataset";

const ENGLISH_OVERVIEW =
  "A SQL exam-prep practice set focused on analyzing a debate competition, registrations, and results.";

const ENGLISH_BACKGROUND = `Debate competition dataset with four linked tables: Debates, Contestants, Enrollments, and Results.

Use the sample tables below as the schema reference, then write SQL queries that help organizers understand registration patterns, attendance, and performance.`;

const QUESTION_TRANSLATIONS = [
  {
    prompt:
      "Show all debate rounds taking place in the next two weeks, together with the number of approved contestants in each round. Include only registrations with status 'approved'. Sort by debate date from nearest to latest.",
    instructions: "Schema: debate ID, topic code, debate date, approved contestant count",
    schema: ["Debate ID", "Topic Code", "Debate Date", "Approved Contestant Count"],
  },
  {
    prompt:
      "Show the contestants who are not registered for any debate round. Display each contestant's first name and last name concatenated into one full-name column. Sort in descending order by full name.",
    instructions: "Schema: contestant ID, full name",
    schema: ["Contestant ID", "Full Name"],
  },
  {
    prompt:
      "For each debate round, show the highest score, the lowest score, and the number of judged contestants. Include only rounds that have results. Sort by debate ID.",
    instructions: "Schema: debate ID, topic code, maximum score, minimum score, contestant count",
    schema: ["Debate ID", "Topic Code", "Maximum Score", "Minimum Score", "Contestant Count"],
  },
  {
    prompt:
      "Show the average score for each school in each debate topic, together with the number of judged contestants. Include only schools with at least 3 contestants. Sort by school and then by topic code.",
    instructions: "Schema: school, topic code, average score, contestant count",
    schema: ["School", "Topic Code", "Average Score", "Contestant Count"],
  },
  {
    prompt:
      "Show contestants who participated in more than one debate round, including the number of rounds and their average score. Count distinct rounds for which the contestant registered. Include only contestants with more than one round.",
    instructions: "Schema: contestant ID, full name, number of rounds, average score",
    schema: ["Contestant ID", "Full Name", "Number of Rounds", "Average Score"],
  },
  {
    prompt:
      "Show only the 2 longest debate rounds that took place in 'North Hall' or lasted more than 120 minutes. Sort by duration from longest to shortest.",
    instructions: "Schema: debate ID, topic code, duration in minutes, hall",
    schema: ["Debate ID", "Topic Code", "Duration Minutes", "Hall"],
  },
  {
    prompt:
      "Show the list of contestants with registration status 'waitlist', together with their debate-round details. Sort by debate date and then by last name.",
    instructions: "Schema: contestant ID, full name, debate ID, topic code, debate date, status",
    schema: ["Contestant ID", "Full Name", "Debate ID", "Topic Code", "Debate Date", "Status"],
  },
  {
    prompt:
      "Show contestants who registered for a debate round but have not yet received a score. Include only approved registrations. Display the contestant, debate-round details, and registration status.",
    instructions: "Schema: contestant ID, full name, debate ID, topic code, status",
    schema: ["Contestant ID", "Full Name", "Debate ID", "Topic Code", "Status"],
  },
  {
    prompt:
      "Show contestants who received a score higher than the overall average score in the system. Use a subquery to calculate the overall average. Display contestant ID, full name, score, and overall average. Sort by score descending.",
    instructions: "Schema: contestant ID, full name, score, overall average",
    schema: ["Contestant ID", "Full Name", "Score", "Overall Average"],
  },
  {
    prompt:
      "Show a list of contestants with the full name in 'last, first' format, and the length of the full name in characters. Sort by last name and then by first name.",
    instructions: "Schema: full name (last, first), name length",
    schema: ["Full Name (Last, First)", "Name Length"],
  },
  {
    prompt:
      "Show a table connecting contestants, debate rounds, and results: contestant name, topic code, debate date, hall, and score. Include only contestants who received a score. Use JOINs between the relevant tables. Sort by contestant name and debate date.",
    instructions: "Schema: contestant name, topic code, debate date, hall, score",
    schema: ["Contestant Name", "Topic Code", "Debate Date", "Hall", "Score"],
  },
];

function nowIso() {
  return new Date().toISOString();
}

function futureIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeId(doc) {
  return String(doc._id || doc.id);
}

function translateSchema(question, index) {
  const translated = QUESTION_TRANSLATIONS[index];
  if (!translated) return question.expectedResultSchema || [];

  return (question.expectedResultSchema || []).map((field, fieldIndex) => ({
    ...field,
    column: translated.schema[fieldIndex] || field.column,
  }));
}

function expectedOutputDescription(index) {
  const translated = QUESTION_TRANSLATIONS[index];
  if (!translated) return "";
  return `Expected output should include these columns: ${translated.schema.join(", ")}.`;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Missing MONGODB_URI in .env.local or .env");
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();

  try {
    const db = client.db(process.env.DB_NAME || "experiment");
    const homeworkSets = db.collection("homework_sets");
    const questions = db.collection("questions");
    const datasets = db.collection("datasets");

    const sourceSet = await homeworkSets.findOne({ title: { $in: SOURCE_TITLES } });
    if (!sourceSet) {
      throw new Error(`Could not find source set: ${SOURCE_TITLES.join(", ")}`);
    }

    const sourceSetId = normalizeId(sourceSet);
    const sourceQuestions = await questions.find({ homeworkSetId: sourceSetId }).toArray();
    const sourceById = new Map(sourceQuestions.map((question) => [question.id || String(question._id), question]));
    const orderedQuestions = (sourceSet.questionOrder || [])
      .map((id) => sourceById.get(id))
      .filter(Boolean);

    if (orderedQuestions.length === 0) {
      throw new Error(`Source set ${sourceSetId} has no ordered questions to clone`);
    }

    const datasetLookup = sourceSet.selectedDatasetId
      ? ObjectId.isValid(sourceSet.selectedDatasetId)
        ? { $or: [{ id: sourceSet.selectedDatasetId }, { _id: new ObjectId(sourceSet.selectedDatasetId) }] }
        : { id: sourceSet.selectedDatasetId }
      : null;
    const sourceDataset = datasetLookup ? await datasets.findOne(datasetLookup) : null;

    const datasetPayload = {
      ...(sourceDataset || {}),
      name: ENGLISH_DATASET_NAME,
      description: "A database for managing a debate competition, registrations, debate rounds, and judging results.",
      scenario:
        "The production team wants to analyze debate-round registrations, load, participation patterns, and results.",
      story: ENGLISH_BACKGROUND,
      connectionUri: "sandbox://datasets/exam-prep-english-screenshot",
      tags: ["exam prep", "debate", "registrations", "results", "english screenshot"],
      updatedAt: nowIso(),
    };
    delete datasetPayload._id;
    delete datasetPayload.id;

    const datasetResult = await datasets.findOneAndUpdate(
      { name: ENGLISH_DATASET_NAME },
      {
        $set: datasetPayload,
        $setOnInsert: { createdAt: nowIso() },
      },
      { upsert: true, returnDocument: "after" },
    );
    const englishDataset = datasetResult;
    const englishDatasetId = normalizeId(englishDataset);

    let englishSet = await homeworkSets.findOne({ title: ENGLISH_SET_TITLE });
    if (!englishSet) {
      const insertResult = await homeworkSets.insertOne({
        courseId: sourceSet.courseId || "sql-course",
        dueAt: futureIso(30),
        availableFrom: nowIso(),
        availableUntil: futureIso(30),
        published: true,
        entryMode: sourceSet.entryMode || "listed",
        homeworkType: sourceSet.homeworkType || "sql",
        datasetPolicy: sourceSet.datasetPolicy || "shared",
        questionOrder: [],
        visibility: "published",
        createdBy: sourceSet.createdBy || "admin",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        title: ENGLISH_SET_TITLE,
        overview: ENGLISH_OVERVIEW,
        backgroundStory: ENGLISH_BACKGROUND,
        selectedDatasetId: englishDatasetId,
      });
      englishSet = await homeworkSets.findOne({ _id: insertResult.insertedId });
    }

    const englishSetId = normalizeId(englishSet);
    await questions.deleteMany({ homeworkSetId: englishSetId });

    const newQuestionOrder = [];
    for (const [index, sourceQuestion] of orderedQuestions.entries()) {
      const translation = QUESTION_TRANSLATIONS[index];
      const questionId = new ObjectId().toHexString();
      const newQuestion = {
        homeworkSetId: englishSetId,
        prompt: translation?.prompt || sourceQuestion.prompt,
        instructions: translation?.instructions || sourceQuestion.instructions,
        expectedOutputDescription: expectedOutputDescription(index),
        starterSql: sourceQuestion.starterSql || "",
        expectedResultSchema: translateSchema(sourceQuestion, index),
        gradingRubric: sourceQuestion.gradingRubric || [],
        datasetId: englishDatasetId,
        maxAttempts: sourceQuestion.maxAttempts || 3,
        points: sourceQuestion.points || 10,
        evaluationMode: sourceQuestion.evaluationMode || "auto",
        parameterMode: sourceQuestion.parameterMode,
        parameters: sourceQuestion.parameters,
        isTemplate: sourceQuestion.isTemplate,
        templateId: sourceQuestion.templateId,
        variables: sourceQuestion.variables,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        id: questionId,
      };

      await questions.insertOne(newQuestion);
      newQuestionOrder.push(questionId);
    }

    await homeworkSets.updateOne(
      { _id: englishSet._id },
      {
        $set: {
          title: ENGLISH_SET_TITLE,
          overview: ENGLISH_OVERVIEW,
          backgroundStory: ENGLISH_BACKGROUND,
          dataStructureNotes: ENGLISH_BACKGROUND,
          selectedDatasetId: englishDatasetId,
          questionOrder: newQuestionOrder,
          dueAt: futureIso(30),
          availableFrom: nowIso(),
          availableUntil: futureIso(30),
          published: true,
          visibility: "published",
          updatedAt: nowIso(),
        },
      },
    );

    console.log(
      JSON.stringify(
        {
          success: true,
          sourceSetId,
          englishSetId,
          englishDatasetId,
          questionsCreated: newQuestionOrder.length,
          builderUrl: `/homework/builder/${englishSetId}/edit`,
          previewUrl: `/homework/builder/${englishSetId}/preview`,
          runnerUrl: `/homework/runner/${englishSetId}?studentId=student-demo`,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
