#!/usr/bin/env python3
"""The Brain: Scores candidates against the job description using Gemini."""

import json
import tempfile
import httpx
from pathlib import Path
from utils import get_supabase_client, get_gemini_client, log

# --- Configuration ---
GRADING_PROMPT_PDF = """You are a strict hiring manager evaluating candidates.

JOB DESCRIPTION:
{job_description}

The candidate's resume PDF is attached. Analyze the full document — layout, formatting,
structure, and content all matter.

Rate this candidate from 0-100 based on how well they match the job description.
Be strict in your evaluation. Only give high scores (80+) to truly exceptional matches."""

GRADING_PROMPT_TEXT = """You are a strict hiring manager evaluating candidates.

JOB DESCRIPTION:
{job_description}

CANDIDATE RESUME:
{resume_text}

Rate this candidate from 0-100 based on how well they match the job description.
Be strict in your evaluation. Only give high scores (80+) to truly exceptional matches."""


def fetch_ungraded_candidates(supabase):
    """Fetch candidates with status NEW_APPLICATION."""
    result = (
        supabase.table("candidates")
        .select("id, email, full_name, resume_text, resume_url, job_description, metadata")
        .eq("status", "NEW_APPLICATION")
        .execute()
    )
    return result.data


def grade_candidate_with_pdf(gemini_client, resume_url: str, job_description: str, cv_prompt: str | None = None) -> dict:
    """Grade by passing the original PDF directly to Gemini for richer analysis."""
    from google.genai import types

    # Download the PDF to a temp file
    response = httpx.get(resume_url)
    response.raise_for_status()

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(response.content)
        tmp_path = tmp.name

    try:
        # Upload to Gemini's file API
        uploaded_file = gemini_client.files.upload(
            file=tmp_path,
            config={"mime_type": "application/pdf"},
        )

        # For PDF grading, use the PDF-specific prompt (DB prompt is text-based)
        prompt = GRADING_PROMPT_PDF.format(job_description=job_description)

        grading_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "score": types.Schema(type=types.Type.INTEGER),
                "reasoning": types.Schema(type=types.Type.STRING),
            },
            required=["score", "reasoning"],
        )

        result = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=grading_schema,
            ),
        )

        # Cleanup uploaded file from Gemini
        gemini_client.files.delete(name=uploaded_file.name)

        return json.loads(result.text.strip())
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def fetch_cv_scoring_prompt(supabase) -> str:
    """Fetch the CV scoring prompt from the prompts table, falling back to the hardcoded default."""
    try:
        result = supabase.table("prompts").select("system_prompt").eq("name", "cv_scoring").single().execute()
        if result.data and result.data.get("system_prompt"):
            return result.data["system_prompt"]
    except Exception as e:
        log("WARN", f"Failed to fetch cv_scoring prompt from DB, using fallback: {e}")
    return GRADING_PROMPT_TEXT


def grade_candidate_with_text(gemini_client, resume_text: str, job_description: str, cv_prompt: str | None = None) -> dict:
    """Fallback: grade using extracted resume text when no PDF URL is available."""
    from google.genai import types

    template = cv_prompt or GRADING_PROMPT_TEXT
    prompt = template.format(
        job_description=job_description,
        resume_text=resume_text,
    )

    grading_schema = types.Schema(
        type=types.Type.OBJECT,
        properties={
            "score": types.Schema(type=types.Type.INTEGER),
            "reasoning": types.Schema(type=types.Type.STRING),
        },
        required=["score", "reasoning"],
    )

    response = gemini_client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=grading_schema,
        ),
    )

    return json.loads(response.text.strip())


def update_candidate_grade(supabase, candidate_id: int, score: int, reasoning: str, existing_metadata: dict):
    """Update the candidate's grade in Supabase."""
    # Merge reasoning into existing metadata
    updated_metadata = existing_metadata or {}
    updated_metadata["grading_reasoning"] = reasoning

    # Set status based on score (50+ passes to mailer, below = rejected)
    status = "GRADED" if score >= 50 else "CV_REJECTED"

    supabase.table("candidates").update({
        "jd_match_score": score,
        "status": status,
        "metadata": updated_metadata
    }).eq("id", candidate_id).execute()


def run_grader() -> int:
    """
    Main grader function - can be called from other modules.
    Returns the number of candidates graded.
    """
    log("INFO", "Starting candidate grading...")

    supabase = get_supabase_client()
    gemini_client = get_gemini_client()

    candidates = fetch_ungraded_candidates(supabase)
    log("INFO", f"Found {len(candidates)} candidate(s) to grade")

    if not candidates:
        log("INFO", "No candidates to grade")
        return 0

    # Fetch configurable CV scoring prompt once for the batch
    cv_prompt = fetch_cv_scoring_prompt(supabase)

    success, failed = 0, 0

    for candidate in candidates:
        try:
            email = candidate["email"]
            resume_url = candidate.get("resume_url")
            resume_text = candidate.get("resume_text", "")
            job_description = candidate.get("job_description", "General software engineering position")

            if not resume_url and not resume_text:
                log("WARN", f"No resume for {email}, skipping")
                continue

            log("INFO", f"Grading {email}...")

            # Prefer PDF when available, fall back to text
            if resume_url:
                log("INFO", f"Using PDF for {email}")
                result = grade_candidate_with_pdf(gemini_client, resume_url, job_description)
            else:
                log("INFO", f"No PDF URL, using text for {email}")
                result = grade_candidate_with_text(gemini_client, resume_text, job_description, cv_prompt)

            score = result.get("score", 0)
            reasoning = result.get("reasoning", "No reasoning provided")

            update_candidate_grade(
                supabase,
                candidate["id"],
                score,
                reasoning,
                candidate.get("metadata", {})
            )

            log("INFO", f"Graded {email}: {score}/100")
            success += 1

        except Exception as e:
            log("ERROR", f"Failed to grade {candidate.get('email', 'unknown')}: {e}")
            failed += 1

    log("INFO", f"Grading complete: {success} succeeded, {failed} failed")
    return success


def main():
    """Entry point when run directly."""
    run_grader()


if __name__ == "__main__":
    main()
