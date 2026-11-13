-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'ADMIN');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DictationCategory" AS ENUM ('GENERAL', 'PROFESSIONAL', 'LEGAL');

-- CreateEnum
CREATE TYPE "DictationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssignmentTargetType" AS ENUM ('STUDENT', 'BATCH');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'EVALUATED');

-- CreateEnum
CREATE TYPE "EvaluationErrorType" AS ENUM ('MISSING', 'EXTRA', 'SUBSTITUTION', 'SPELLING', 'PUNCTUATION', 'CASING', 'WHITESPACE');

-- CreateEnum
CREATE TYPE "FeeStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TypingTestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "email" STRING NOT NULL,
    "emailVerified" BOOL NOT NULL DEFAULT false,
    "image" STRING,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" STRING NOT NULL,
    "userId" STRING NOT NULL,
    "phone" STRING,
    "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" STRING,
    "batchId" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" STRING NOT NULL,
    "name" STRING NOT NULL,
    "schedule" STRING NOT NULL,
    "time" STRING NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dictation" (
    "id" STRING NOT NULL,
    "title" STRING NOT NULL,
    "category" "DictationCategory" NOT NULL,
    "status" "DictationStatus" NOT NULL DEFAULT 'DRAFT',
    "referenceTranscript" STRING NOT NULL,
    "audioObjectKey" STRING,
    "durationSeconds" INT4,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Dictation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" STRING NOT NULL,
    "dictationId" STRING NOT NULL,
    "targetType" "AssignmentTargetType" NOT NULL,
    "studentId" STRING,
    "batchId" STRING,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3),
    "allowReplay" BOOL NOT NULL DEFAULT true,
    "blindMode" BOOL NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" STRING NOT NULL,
    "assignmentId" STRING NOT NULL,
    "studentId" STRING NOT NULL,
    "submittedText" STRING NOT NULL,
    "elapsedMs" INT4 NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" STRING,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" STRING NOT NULL,
    "attemptId" STRING NOT NULL,
    "overallAccuracy" FLOAT8 NOT NULL,
    "wordAccuracy" FLOAT8 NOT NULL,
    "characterAccuracy" FLOAT8 NOT NULL,
    "expectedWordCount" INT4 NOT NULL,
    "typedWordCount" INT4 NOT NULL,
    "correctCount" INT4 NOT NULL,
    "missingCount" INT4 NOT NULL,
    "extraCount" INT4 NOT NULL,
    "substitutionCount" INT4 NOT NULL,
    "spellingErrorCount" INT4 NOT NULL,
    "punctuationDifferenceCount" INT4 NOT NULL,
    "correctCharacterCount" INT4 NOT NULL,
    "incorrectCharacterCount" INT4 NOT NULL,
    "wpm" FLOAT8 NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationError" (
    "id" STRING NOT NULL,
    "attemptId" STRING NOT NULL,
    "type" "EvaluationErrorType" NOT NULL,
    "position" INT4 NOT NULL,
    "expected" STRING,
    "actual" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypingTest" (
    "id" STRING NOT NULL,
    "title" STRING NOT NULL,
    "category" "DictationCategory" NOT NULL,
    "text" STRING NOT NULL,
    "status" "TypingTestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "TypingTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypingAttempt" (
    "id" STRING NOT NULL,
    "typingTestId" STRING NOT NULL,
    "studentId" STRING NOT NULL,
    "typedText" STRING NOT NULL,
    "elapsedMs" INT4 NOT NULL,
    "wpm" FLOAT8 NOT NULL,
    "accuracy" FLOAT8 NOT NULL,
    "correctCharacters" INT4 NOT NULL,
    "incorrectCharacters" INT4 NOT NULL,
    "completed" BOOL NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TypingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" STRING NOT NULL,
    "studentId" STRING NOT NULL,
    "amount" INT4 NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FeeStatus" NOT NULL DEFAULT 'PENDING',
    "paidDate" TIMESTAMP(3),
    "notes" STRING,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "recordedById" STRING,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" STRING NOT NULL,
    "dictationId" STRING NOT NULL,
    "audience" STRING NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" STRING NOT NULL,
    "text" STRING NOT NULL,
    "published" BOOL NOT NULL DEFAULT true,
    "createdById" STRING NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_batchId_idx" ON "StudentProfile"("batchId");

-- CreateIndex
CREATE INDEX "StudentProfile_status_idx" ON "StudentProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_name_key" ON "Batch"("name");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE INDEX "Dictation_status_idx" ON "Dictation"("status");

-- CreateIndex
CREATE INDEX "Dictation_category_idx" ON "Dictation"("category");

-- CreateIndex
CREATE INDEX "Dictation_createdById_idx" ON "Dictation"("createdById");

-- CreateIndex
CREATE INDEX "Assignment_dictationId_idx" ON "Assignment"("dictationId");

-- CreateIndex
CREATE INDEX "Assignment_studentId_idx" ON "Assignment"("studentId");

-- CreateIndex
CREATE INDEX "Assignment_batchId_idx" ON "Assignment"("batchId");

-- CreateIndex
CREATE INDEX "Assignment_targetType_idx" ON "Assignment"("targetType");

-- CreateIndex
CREATE INDEX "Attempt_assignmentId_idx" ON "Attempt"("assignmentId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_createdAt_idx" ON "Attempt"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Attempt_status_idx" ON "Attempt"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResult_attemptId_key" ON "EvaluationResult"("attemptId");

-- CreateIndex
CREATE INDEX "EvaluationResult_overallAccuracy_idx" ON "EvaluationResult"("overallAccuracy");

-- CreateIndex
CREATE INDEX "EvaluationResult_createdAt_idx" ON "EvaluationResult"("createdAt");

-- CreateIndex
CREATE INDEX "EvaluationError_attemptId_idx" ON "EvaluationError"("attemptId");

-- CreateIndex
CREATE INDEX "EvaluationError_attemptId_position_idx" ON "EvaluationError"("attemptId", "position");

-- CreateIndex
CREATE INDEX "EvaluationError_type_idx" ON "EvaluationError"("type");

-- CreateIndex
CREATE INDEX "TypingTest_status_idx" ON "TypingTest"("status");

-- CreateIndex
CREATE INDEX "TypingTest_category_idx" ON "TypingTest"("category");

-- CreateIndex
CREATE INDEX "TypingAttempt_typingTestId_idx" ON "TypingAttempt"("typingTestId");

-- CreateIndex
CREATE INDEX "TypingAttempt_studentId_createdAt_idx" ON "TypingAttempt"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "Fee_studentId_idx" ON "Fee"("studentId");

-- CreateIndex
CREATE INDEX "Fee_status_idx" ON "Fee"("status");

-- CreateIndex
CREATE INDEX "Fee_dueDate_idx" ON "Fee"("dueDate");

-- CreateIndex
CREATE INDEX "Schedule_dictationId_idx" ON "Schedule"("dictationId");

-- CreateIndex
CREATE INDEX "Schedule_startsAt_idx" ON "Schedule"("startsAt");

-- CreateIndex
CREATE INDEX "Schedule_status_idx" ON "Schedule"("status");

-- CreateIndex
CREATE INDEX "Announcement_published_createdAt_idx" ON "Announcement"("published", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dictation" ADD CONSTRAINT "Dictation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_dictationId_fkey" FOREIGN KEY ("dictationId") REFERENCES "Dictation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationError" ADD CONSTRAINT "EvaluationError_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingTest" ADD CONSTRAINT "TypingTest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingAttempt" ADD CONSTRAINT "TypingAttempt_typingTestId_fkey" FOREIGN KEY ("typingTestId") REFERENCES "TypingTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TypingAttempt" ADD CONSTRAINT "TypingAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_dictationId_fkey" FOREIGN KEY ("dictationId") REFERENCES "Dictation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

