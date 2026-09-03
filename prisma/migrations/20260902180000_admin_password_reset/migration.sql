-- Admin-initiated password reset.
-- While true, every guard diverts the user to the change-password screen, so the
-- temporary password an admin hands over cannot be used for anything else.
ALTER TABLE "User" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
