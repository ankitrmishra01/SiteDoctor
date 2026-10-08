async function run() {
  const r = await fetch("https://api.github.com/users/ankitrmishra01/repos?per_page=100", {
    headers: { "User-Agent": "SiteDoctor-Audit" }
  });
  const repos = await r.json();
  console.log("Total Repos:", repos.length);
  
  const results = [];
  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    let liveUrl = repo.homepage ? repo.homepage.trim() : null;
    if (!liveUrl || !liveUrl.startsWith("http")) {
      for (const branch of ["main", "master"]) {
        try {
          const res = await fetch(`https://raw.githubusercontent.com/ankitrmishra01/${repo.name}/${branch}/README.md`);
          if (res.ok) {
            const text = await res.text();
            const match = text.match(/https?:\/\/[a-zA-Z0-9-]+\.(vercel\.app|netlify\.app|onrender\.com|railway\.app|github\.io)[^\s)"']*/i);
            if (match) {
              liveUrl = match[0].replace(/[\.\,\)]+$/, "");
              break;
            }
          }
        } catch {}
      }
    }
    results.push({
      num: i + 1,
      repo: repo.name,
      status: (liveUrl && liveUrl.startsWith("http")) ? "FOUND" : "NOT FOUND",
      url: (liveUrl && liveUrl.startsWith("http")) ? liveUrl : "—"
    });
  }
  console.log(JSON.stringify(results, null, 2));
}
run();
