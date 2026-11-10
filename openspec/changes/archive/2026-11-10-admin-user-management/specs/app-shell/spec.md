# Spec Delta

## ADDED Requirements

### Requirement: Admin navigation

The shell SHALL expose a user-management navigation link only to authenticated administrators. Members and anonymous visitors MUST NOT see the link.

#### Scenario: Admin sees the link
- **WHEN** an administrator views the shell
- **THEN** a link to `/admin/users` is present and keyboard reachable

#### Scenario: Member does not see the link
- **WHEN** a member views the shell
- **THEN** no admin user-management link is rendered
