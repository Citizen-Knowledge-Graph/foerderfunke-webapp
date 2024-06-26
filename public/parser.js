
async function parseTurtleFiles() {
    turtleMap = {
        "datafields": await fetchAsset("requirement-profiles/datafields.ttl"),
        "materialization": await fetchAsset("requirement-profiles/materialization.ttl"),
        "shacl": {}
    }
    const shaclListCsv = await fetchAsset("shacl-list.csv")
    for (let line of shaclListCsv.split("\n")) {
        let [filename, rpUri] = line.split(",")
        rpUri = expandShortUri(rpUri)
        turtleMap.shacl[rpUri] = await fetchAsset("requirement-profiles/shacl/" + filename)
    }
    metadata = {
        df: await MatchingEngine.extractDatafieldsMetadata(turtleMap.datafields),
        rp: await MatchingEngine.extractRequirementProfilesMetadata(Object.values(turtleMap.shacl))
    }
    console.log("metadata", metadata)

    buildFocusInputSelectChoices()
}
