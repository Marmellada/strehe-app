# Campaign Naming and First-Touch Attribution

Campaign naming convention:

`strehe_<channel>_<market>_<objective>_<yyyymm>`

Examples:

- `strehe_meta_diaspora_founders_202608`
- `strehe_direct_referral_founders_202608`

Names are editable. Campaign records are channel-neutral and hold channel, status,
dates, planned budget, actual spend, and notes.

First-touch fields are source, source detail, campaign id/name, UTM source,
medium, campaign, content and term, a supported advertising click id, landing
locale/page, and timestamp. Inputs are normalized and bounded. The original
values are protected from silent replacement. Later attribution evidence belongs
in an interaction note; multi-touch modeling is out of scope.

Cost per stage equals actual campaign spend divided by the evidenced stage count.
Zero denominators display no value. CAC uses paying customers backed by recorded
payments.

