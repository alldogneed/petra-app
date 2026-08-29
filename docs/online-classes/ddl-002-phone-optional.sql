-- Online Classes 002: PortalUser.phone becomes optional.
-- Students can be enrolled into a course by email alone (email is the portal identity —
-- login is email OTP). Unique index still holds; Postgres allows multiple NULLs.
ALTER TABLE "PortalUser" ALTER COLUMN "phone" DROP NOT NULL;
