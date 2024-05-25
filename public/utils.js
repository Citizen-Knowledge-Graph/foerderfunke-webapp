
async function checkForNewRepoCommits() {
    console.log("Checking for updates, old commit:", latestRPsRepoCommit)
    let checkLatestRPsRepoCommit = await fetchAsset("latest-rps-repo-commit.txt")
    // TODO also check foerderfunke-webapp latest commit
    if (checkLatestRPsRepoCommit === latestRPsRepoCommit) return
    console.log("Update available, new commit:", checkLatestRPsRepoCommit)
    latestRPsRepoCommit = checkLatestRPsRepoCommit
    document.getElementById("update-banner").style.display = "block"
    let eligibleRPsBefore = [... eligibleRPs]
    await parseTurtleFiles()
    await update()
    let newEligibleRPs = eligibleRPs.filter(rp => !eligibleRPsBefore.includes(rp))
    if (newEligibleRPs.length > 0) {
        document.title = `(${newEligibleRPs.length}) ${document.title}`
        alert("New eligible requirement profiles available: " + newEligibleRPs.map(rpUri => getRpTitle(rpUri)).join(", "))
    }
}

function dfShortUriToLabel(key) {
    return metadata.df[expandShortUri(key)]?.label ?? key
}

function expandShortUri(uri) {
    return uri.startsWith("ff:") ? "https://foerderfunke.org/default#" + uri.slice(3) : uri
}

function shortenLongUri(uri) {
    return uri.startsWith("http") ? "ff:" + uri.split("#")[1] : uri
}

function determineLabelForObjectValue(str) {
    if (metadata.df[str]) return metadata.df[str].label
    if (metadata.rp[str]) return metadata.rp[str].title
    return shortenLongUri(str)
}

function buildRowAndColumns(table) {
    let tr = document.createElement("tr")
    table.appendChild(tr)
    let tds = []
    for (let i = 0; i < maxDepth + 3; i++) {
        let td = document.createElement("td")
        tr.appendChild(td)
        tds.push(td)
    }
    return tds
}

function getRpTitle(rpUri) {
    return metadata.rp[rpUri]?.title ?? rpUri
}

async function fetchAsset(relPath) {
    const response = await fetch("assets/" + relPath, {
        method: "GET",
        cache: "reload"
    })
    return await response.text()
}

async function clearUserProfile() {
    localStorage.setItem("userProfile", JSON.stringify(EMPTY_PROFILE))
    userProfile = JSON.parse(localStorage.getItem("userProfile"))
    await update()
}

async function importUserProfileTurtle() {
    alert("TODO")
    // TODO
}

async function downloadUserProfileTurtle() {
    let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
    let blob = new Blob([userProfileTurtle], {type: "text/turtle"})
    let url = URL.createObjectURL(blob)
    let a = document.createElement("a")
    a.href = url
    a.download = "user-profile.ttl"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
}

async function showUserProfileTurtle() {
    let userProfileTurtle = await MatchingEngine.convertUserProfileToTurtle(userProfile)
    alert(userProfileTurtle)
}
