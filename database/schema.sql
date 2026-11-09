-- ====================================================================
-- CampusFix Supabase PostgreSQL Database Schema
-- Safe / Non-destructive: Uses IF NOT EXISTS throughout
-- ====================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'staff', 'admin')),
    firebase_uid TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure firebase_uid exists if users table was created earlier
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Issues / Complaints Table
CREATE TABLE IF NOT EXISTS public.issues (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    priority TEXT DEFAULT 'MEDIUM',
    location TEXT,
    image TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reported_by BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    assigned_to BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    department_id BIGINT REFERENCES public.departments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS department_id BIGINT;

ALTER TABLE public.issues
ADD COLUMN IF NOT EXISTS image TEXT;

-- 4. Issue Community Votes (Me-too / Upvotes)
CREATE TABLE IF NOT EXISTS public.issue_votes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_issue_user_vote UNIQUE (issue_id, user_id)
);

-- 5. Issue Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Notifications Table (Includes title and type matching application routes)
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    issue_id BIGINT REFERENCES public.issues(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Notification',
    message TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add title and type columns if notifications table already exists
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT 'Notification';

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';

-- 7. Issue Status History Table
CREATE TABLE IF NOT EXISTS public.issue_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    issue_id BIGINT NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    old_status TEXT,
    new_status TEXT NOT NULL,
    changed_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON public.users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_category ON public.issues(category);
CREATE INDEX IF NOT EXISTS idx_issues_reported_by ON public.issues(reported_by);
CREATE INDEX IF NOT EXISTS idx_issues_assigned_to ON public.issues(assigned_to);
CREATE INDEX IF NOT EXISTS idx_issues_department ON public.issues(department_id);
CREATE INDEX IF NOT EXISTS idx_issue_votes_issue ON public.issue_votes(issue_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON public.comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 9. Complaint Statistics View
CREATE OR REPLACE VIEW public.complaint_statistics AS
SELECT status, COUNT(*) AS total_complaints
FROM public.issues
GROUP BY status;
