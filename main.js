import {jsPlumbBrowserUI} from "./modules/jsplumb.js"
import {HttpRequests as requests} from "./httprequests.js";

class NodeList {
    _nodeList = {} // dict<int, jsonData>

    validId(id) {
        return true // todo: this doesn't work
        // id is not empty string and id only contains numbers
        const strId = id.toString()
        return strId !== "" && strId.match(/^\d+$/)
    }

    async get(id="0") {
        if (!this.validId(id))
            return false

        if (id in this._nodeList) {
            return this._nodeList[id]
        } else {
            await this.update(id)
            if (id in this._nodeList) {
                return this._nodeList[id]
            } else {
                return false
            }
        }
    }

    put(id, json) {
        if (!this.validId(id))
            return false

        this._nodeList[id] = json
    }

    has(id) {
        return id in this._nodeList
    }

    async update(id) {
        if (!this.validId(id))
            return false

        const _rootNodeJSON = await requests.getNode(id)
        // todo: make sure to remove deleted nodes from nodeList
        console.log(_rootNodeJSON)
        if (_rootNodeJSON) {
            singleNodeFromJSON(_rootNodeJSON)
        }
    }
}

const nodeList = new NodeList()

function nodesFromJSON(nodeJSON) {
    for (let node of nodeJSON) {
        singleNodeFromJSON(node)
    }
}

function singleNodeFromJSON(nodeJSON) {
    nodeList.put(nodeJSON.id, nodeJSON)
}

async function listAllButtonFunc() {
    const listAllText = document.getElementById("list-all-nodes-text")
    const graph = await requests.getGraph()
    listAllText.innerText = JSON.stringify(graph)

    nodesFromJSON(graph.nodes)
}

async function addNodeButtonFunc() {
    const addNodeText = document.getElementById("add-node-text")
    const newNodeId = await requests.addNode("comment", "Made by 'Add Node'")
    addNodeText.innerText = JSON.stringify(await nodeList.get(newNodeId))
    await updateDisplayedNode(newNodeId)
}

async function updateDisplayedNode(id=null) {
    const nodeInput = document.getElementById("node-input")

    if (id !== null) {
        nodeInput.value = id
    }

    const node = await nodeList.get(nodeInput.value)
    if (node) {
        const titleInput = document.getElementById("title-input")
        const contentInput = document.getElementById("content-input")
        const titleDisplay = document.getElementById("selected-node-view")

        titleInput.value = node["title"]
        contentInput.value = node["content"]
        titleDisplay.innerText = node["title"]
    }
}

async function saveButtonFunc() {
    /*
    if nodeInput.value not in nodeList, try to get it from server (nodeList might handle this automatically)
    if the server doesn't have that id, then send an add request

    else if nodeInput.value in nodeList, send an update request for title and content if they're different
    than nodeList's copy of them
     */
    const nodeInput = document.getElementById("node-input")
    const titleInput = document.getElementById("title-input")
    const contentInput = document.getElementById("content-input")
    const nodeId = nodeInput.value

    const node = nodeList.get(nodeId)
    if (!node) {
        // todo: node type support
        // todo: this doesn't work
        const newNodeId = await requests.addNode("concept", titleInput.value, contentInput.value)
        await updateDisplayedNode(newNodeId)
    }
    else {
        let u = false
        if (titleInput.value !== node.title) {
            u = true
            await requests.updateNode(nodeId, "title", titleInput.value)
        }

        if (contentInput.value !== node.content) {
            u = true
            await requests.updateNode(nodeId, "content", contentInput.value)
        }

        if (u) {
            await nodeList.update(nodeId)
        }
    }
}

async function init() {
    await updateDisplayedNode(0)

    const nodeInput = document.getElementById("node-input")
    nodeInput.oninput = () => updateDisplayedNode()
    const saveButton = document.getElementById("save-button")
    saveButton.onclick = saveButtonFunc

    const listAllButton = document.getElementById("list-all-nodes-button")
    listAllButton.onclick = listAllButtonFunc
    const addNodeButton = document.getElementById("add-node-button")
    addNodeButton.onclick = addNodeButtonFunc
}

init()
