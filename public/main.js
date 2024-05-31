
const EMPTY_PROFILE = { "@id": "ff:mainPerson", "@type": "ff:Citizen" }
let userProfile
let maxDepth = 0
let latestRPsRepoCommit
let turtleMap
let metadata
let validateAllReport
let eligibleRPs

async function run() {
    latestRPsRepoCommit = await fetchAsset("latest-rps-repo-commit.txt")
    setInterval(checkForNewRepoCommits, 60 * 1000)

    await parseTurtleFiles()

    if (localStorage.getItem("userProfile") === null) {
        localStorage.setItem("userProfile", JSON.stringify(EMPTY_PROFILE))
    }
    userProfile = JSON.parse(localStorage.getItem("userProfile"))
    if (!await validateUserProfile()) {
        alert("Please reset your profile")
        return
    }

    await update()
}
