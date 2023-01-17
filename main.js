import {jsPlumbBrowserUI} from "./modules/jsplumb.js"
import {HttpRequests as requests} from "./httprequests.js";

const instance = jsPlumbBrowserUI.newInstance({
    container: document.getElementById("graph-view")
})

instance.bind("ready", () => {
    // your jsPlumb related init code goes here
    //addEndpoints()
});

function addEndpoints() {
    instance.manage(document.getElementById("gn1"))
    instance.manage(document.getElementById("gn2"))
    instance.manage(document.getElementById("gn3"))
    /*instance.manage("gn1")
    instance.manage("gn2")
    instance.manage("gn3")*/
    console.log("endpoints added")
}

async function listAllButtonFunc() {
    const listAllText = document.getElementById("list-all-nodes-text")
    listAllText.innerText = await requests.listNodeIds()
}

async function addNodeButtonFunc() {
    const addNodeText = document.getElementById("add-node-text")
    addNodeText.innerText = await requests.addNode()
}

function assignButtons() {
    const listAllButton = document.getElementById("list-all-nodes-button")
    listAllButton.onclick = listAllButtonFunc
    const addNodeButton = document.getElementById("add-node-button")
    addNodeButton.onclick = addNodeButtonFunc
}

addEndpoints()
assignButtons()
