import {HttpRequests as requests} from "./httprequests.js";

class NodeList {
    _nodeList = {} // dict<int, jsonData>

    validId(id) {
        /*
        true if id is positive integer or string containing positive integer.

        else false.
         */
        if (id === undefined) {
            return false
        }

        const strId = id.toString()
        return strId !== "" && strId.match(/^\d+$/) !== null
    }

    async get(id="0") {
        /*
        returns json object of node with given id.

        if the nodeList doesn't have the node, it will attempt to retrieve it from the server.
        if the server doesn't have the node, or an invalid id is provided, this will return false.
         */
        if (!this.validId(id))
            return false

        if (id in this._nodeList) {
            return this._nodeList[id]
        } else {
            await this.update(id)
            if (this.has(id)) {
                return this._nodeList[id]
            } else {
                return false
            }
        }
    }

    put(id, json) {
        /*
        adds a key-value pair to the underlying dictionary: {id: json}.

        json should be a node's json object, e.g. {"id": "0", "title": "root", "content": "", "type": "root"}
         */
        if (!this.validId(id))
            return false

        this._nodeList[id] = json
    }

    has(id) {
        /*
        returns true if the id is in the node list. be aware that NodeList.get(id) handles this automatically.
         */
        return id in this._nodeList
    }

    async update(id) {
        /*
        retrieves node "id" from the server, then adds it to the node list.

        returns false if node id is invalid. returns true if successful.
         */
        if (!this.validId(id))
            return false

        const _rootNodeJSON = await requests.getNode(id)
        if (_rootNodeJSON) {
            singleNodeFromJSON(_rootNodeJSON)
            return true
        }

        return false
    }

    async delete(id) {
        // todo: make sure to remove deleted nodes from nodeList
    }
}

const nodeList = new NodeList()

function nodesFromJSON(nodeJSON) {
    for (let node of nodeJSON) {
        singleNodeFromJSON(node)
    }
}

function singleNodeFromJSON(nodeJSON) {
    // might be better to put this inside NodeList
    nodeList.put(nodeJSON.id, nodeJSON)
}

async function listAllButtonFunc() {
    const listAllText = document.getElementById("list-all-nodes-text")
    const graph = await requests.getGraph()
    listAllText.innerText = JSON.stringify(graph)

    nodesFromJSON(graph.nodes)
}

async function updateDisplayedNode(id=null) {
    /*
    display the node specified by `id` param. if id is null, display node specified by
    the "node-input" input box.

    handles all things necessary to change the displayed node.
     */
    const nodeInput = document.getElementById("node-input")
    const titleInput = document.getElementById("title-input")
    const contentInput = document.getElementById("content-input")
    const titleDisplay = document.getElementById("selected-node-view")

    if (id !== null) {
        nodeInput.value = id
    }

    if (nodeInput.value === "0") { // can't edit root node
        titleInput.setAttribute("disabled", "")
        contentInput.setAttribute("disabled", "")
    } else {
        titleInput.removeAttribute("disabled")
        contentInput.removeAttribute("disabled")
    }

    const node = await nodeList.get(nodeInput.value)
    if (node) {
        titleInput.value = node["title"]
        contentInput.value = node["content"]
        // todo: move the node id display to a different element
        // todo: better way to handle excessively long titles
        titleDisplay.innerText = `[${node["id"]}] ${node["title"]}`
    } else { // invalid node
        titleInput.value = ""
        contentInput.value = ""
        if(nodeInput.value === "") {
            titleDisplay.innerText = "[] No node selected."
        } else {
            titleDisplay.innerText = "[] Node does not exist."
        }
    }
}

async function updateButtonFunc() {
    /*
    tell the server to set the selected node's attributes to the values in
    the editor boxes. if the values are already accurate, no change.
     */
    const nodeInput = document.getElementById("node-input")
    const titleInput = document.getElementById("title-input")
    const contentInput = document.getElementById("content-input")
    const nodeId = nodeInput.value

    const node = await nodeList.get(nodeId)
    if (!node) {
        // todo: error message?
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
            await updateDisplayedNode()
        }
    }
}

async function createButtonFunc() {
    /*
    creates a new node using the title and content from their respective input boxes. then displays the new node.
     */
    const titleInput = document.getElementById("title-input")
    const contentInput = document.getElementById("content-input")

    // todo: support for user-specified node type
    const newNodeId = await requests.addNode("concept", titleInput.value, contentInput.value)
    await updateDisplayedNode(newNodeId)
}

async function init() {
    await updateDisplayedNode(0)

    const nodeInput = document.getElementById("node-input")
    nodeInput.oninput = () => updateDisplayedNode()
    const saveButton = document.getElementById("update-button")
    saveButton.onclick = updateButtonFunc
    const createButton = document.getElementById("create-button")
    createButton.onclick = createButtonFunc

    const listAllButton = document.getElementById("list-all-nodes-button")
    listAllButton.onclick = listAllButtonFunc
}

init()
