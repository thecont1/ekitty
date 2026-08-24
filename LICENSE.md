ekitty Business Source License
==============================

Version 1.0 — Effective 2026-08-24
Copyright (c) 2026 Mahesh Shantaram

This is a source-available license intended to allow you to read, learn from,
and modify the ekitty codebase for your own personal, non-commercial use,
while *prohibiting* you from operating ekitty as a competing paid service or
distributing it as a general-purpose product without a separate commercial
agreement.

Individual users get the freedom to run, study, and adapt the software for
themselves. Businesses that want to use ekitty commercially must obtain a
paid license.

This is **not** legal advice. If you require legal certainty, consult a
qualified lawyer in your jurisdiction.

1. Definitions
--------------

- **Software** means the ekitty codebase and all files in this repository,
  including modifications and derivative works you create based on it. This
  includes the portfolio calculation and visualisation logic under
  `client/src/lib/`, all shared components and hooks, the build
  configuration (`vite.config.ts`), and the production server
  (`server/index.ts`).

- **Licensor** means the copyright holder, Mahesh Shantaram.

- **You** (or **Your**) means any individual or legal entity exercising
  permissions granted by this license.

- **Production Use** means using the Software, or making it available for
  use, in any way that provides value to third parties beyond yourself or
  your own organization (for example: hosting it for clients, embedding it
  in a product, or offering it as a service).

- **Competing Service** means any hosted or distributed software whose
  primary purpose is substantially similar to that of ekitty: visualising
  investment portfolios or financial holdings as interactive, animated, or
  gamified visual fields for investors or clients.

- **Non-Commercial Use** means use that is not intended to generate direct
  or indirect revenue, consideration, or commercial advantage. Personal
  portfolio tracking, learning, academic research, and internal experiments
  generally qualify as Non-Commercial Use. Tracking Your own investments —
  regardless of their size — is Non-Commercial Use.

2. Grant of Rights
------------------

Subject to the terms and conditions of this license, Licensor grants You a
non-exclusive, worldwide, non-transferable license to:

- **View and study** the Software.
- **Modify** the Software for your own purposes.
- **Use** the Software for Non-Commercial Use for yourself or within your
  own household/organization.

You may run the Software internally for evaluation, experimentation,
research, or managing Your own finances without paying a fee to the
Licensor, provided that such use is Non-Commercial and not a Competing
Service.

3. Restrictions
---------------

Except as expressly permitted above, You **may not**:

1. Offer the Software, or any modified version of it, as a hosted or managed
   service to third parties without a separate written agreement with
   Licensor.

2. Sell, license, sublicense, rent, lease, or otherwise commercially exploit
   the Software as a product or service, including as part of a brokerage,
   wealth-management, fintech, consulting, SaaS, or analytics offering,
   without a separate written agreement with Licensor.

3. Use the Software to operate any **Competing Service**, whether paid or
   unpaid, without a separate written agreement with Licensor.

4. Redistribute the Software, or substantial portions of it, in source or
   binary form to third parties, except:
   - as part of an academic paper, blog post, portfolio, or similar work
     where small excerpts of code are quoted for illustrative purposes; or
   - as explicitly permitted in writing by Licensor.

5. Remove or alter any copyright notices, license notices, or attribution
   to the Licensor in the Software (including the on-screen credit notice).

Any attempt to circumvent these restrictions (for example by providing
"deployment scripts" that cause others to host the Software for third
parties) is considered a violation of this license.

4. Data Privacy by Design
-------------------------

The Software processes portfolio data entirely client-side: CSV parsing,
calculations, persistence (browser localStorage), and rendering all happen
in the user's browser. The Software ships with no server-side data store.
This architecture is part of the licensed work; modified versions that ship
portfolio data to any server are still bound by this license.

5. Contributions
----------------

If You submit changes, pull requests, or other contributions to the
Software, You agree that Licensor may use, modify, and incorporate those
contributions into the Software and any commercial versions of it without
additional obligation to You, unless a separate written agreement states
otherwise.

You are not required to submit any modifications You make; this license
does not obligate You to contribute code back.

6. No Warranty
--------------

THE SOFTWARE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN
NO EVENT SHALL THE LICENSOR BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.

7. Limitation of Liability
--------------------------

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, LICENSOR SHALL NOT BE
LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
DAMAGES, OR ANY LOSS OF PROFITS OR REVENUE, WHETHER INCURRED DIRECTLY OR
INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES,
RESULTING FROM YOUR USE OF OR INABILITY TO USE THE SOFTWARE. Nothing in the
Software constitutes financial advice; the Licensor accepts no liability
for investment decisions made on the basis of information displayed by the
Software.

8. Term and Termination
-----------------------

This license is effective from the date You first access or use the
Software and continues until terminated.

Licensor may terminate this license immediately if You violate any of its
terms. Upon termination, You must stop using the Software and destroy any
copies in Your possession or control. Termination does not limit any of
Licensor's rights or remedies at law or in equity.

9. Commercial Licensing
-----------------------

If You wish to:

- offer the Software as a hosted or managed service,
- integrate it into a commercial product,
- use it within a business, brokerage, or advisory practice, or
- operate it as part of any Competing Service,

You must obtain a separate commercial license from the Licensor.

To inquire about commercial licensing, contact:

> Mahesh Shantaram
> Email: ms@thecontrarian.in

10. Governing Law
-----------------

This license shall be governed by and construed in accordance with the laws
of India, without regard to its conflict-of-law principles, unless otherwise
required by applicable law.

---

By using, copying, or modifying the Software, You acknowledge that You have
read, understood, and agree to be bound by the terms of this license.
