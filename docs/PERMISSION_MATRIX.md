# Site Connect permission matrix

Database RLS/RPC validation is authoritative; route visibility is only a usability layer. Every role is organization-scoped.

| Module | Site staff | Manager | HOD | Admin/HR | Accounts | Super Admin |
|---|---|---|---|---|---|---|
| Attendance | Own + assigned projects | Reporting users/projects | Department hierarchy/projects | People administration | None | Organization administration |
| Leave | Own | Reporting users | Department hierarchy | People administration | None | Organization administration |
| DPR / Field Ops | Own assigned projects | Reporting/managed projects | Department projects | Operational visibility only | None | Organization administration |
| Claims | Own | Scoped approval | Scoped approval | Verification/people stage | Finance stage | Authorized organization workflow |
| Materials, Fuel, Machinery, Labour, Tasks | Assigned projects | Reporting/managed projects | Department/projects | People/operations, no blanket finance | Finance-only records where applicable | Organization administration |
| Vendors / Finance | No | Source/project scope | Project scope | Vendor verification, no payment authority | Voucher/payment authority | Authorized organization workflow |
| Messaging | Membership/project scope | Membership/project scope | Membership/department scope | Membership/people scope | Membership/finance scope | Organization scope |
| Projects / Users / Settings | No | No | Hierarchy view only | People and master administration | Finance settings only | Organization administration |
| Communication Center | No | No | No | No | No | Full organization configuration and audit |

Communication Center mutations additionally verify a current Supabase Auth session. Attendance communication is prohibited by table checks and is not represented by an event rule.
