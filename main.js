import {HttpRequests as requests} from "./httprequests.js";

class NodeList {
    _nodeList = {} // dict<int, jsonData>

    _selected = null
    get selectedNode() { return this._selected; }
    set selectedNode(id) {
        /* does not call this.get(id), so this won't automatically get the node from the server. see this.select(id) */
        if (id === null || this.has(id)) {
            this._selected = id
            return true
        } else {
            this._selected = null
            return false
        }
    }

    async select(id) {
        /* unlike selectedNode setter, this gets the node from the server if necessary */
        if (id === null || await this.get(id)) {
            this._selected = id
            return true
        } else {
            this._selected = null
            return false
        }
    }

    static validId(id) {
        /*
        true if id is positive integer or string containing positive integer.

        else false.
         */
        if (id === undefined || id === null) {
            return false
        }

        const strId = id.toString()
        return strId !== "" && strId.match(/^\d+$/) !== null
    }

    static nodesFromJSON(nodeJSON) {
        let njson = nodeJSON
        if ("nodes" in nodeJSON) {
            njson = nodeJSON["nodes"]
        }

        for (let node of njson) {
            nodeList.put(nodeJSON.id, nodeJSON)
        }
    }

    async get(id="0") {
        /*
        returns json object of node with given id.

        if the nodeList doesn't have the node, it will attempt to retrieve it from the server.
        if the server doesn't have the node, or an invalid id is provided, this will return false.
         */
        if (!NodeList.validId(id))
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

    async getNode(id) {
        /* alias for NodeList.get(id) */
        return this.get(id)
    }

    put(id, json) {
        /*
        adds a key-value pair to the underlying dictionary: {id: json}.

        json should be a node's json object, e.g. {"id": "0", "title": "root", "content": "", "type": "root"}
         */
        if (!NodeList.validId(id))
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
        if (!NodeList.validId(id))
            return false

        const _rootNodeJSON = await requests.getNode(id)
        if (_rootNodeJSON) {
            NodeList.nodesFromJSON(_rootNodeJSON)
            return true
        }

        return false
    }

    async delete(id) {
        // todo: make sure to remove deleted nodes from nodeList
    }

    async getNeighbors(id) {
        /*
        get predecessors and successors of node 'id'. returns json object with a "nodes" and an "edges" attribute.
         */
        if (!NodeList.validId(id)) {
            return false
        }

        const n = await requests.getNeighbors(id)
        NodeList.nodesFromJSON(n)

        return n
    }
}

const nodeList = new NodeList()

async function updateNodeNeighborList() {
    /*
    updates the lists that display the selected node's predecessors and successors.
     */
    const preList = document.getElementById("upper-neighbor-select")
    const sucList = document.getElementById("lower-neighbor-select")
    preList.innerHTML = "" // removes all child elements
    sucList.innerHTML = "" // removes all child elements

    const neighbors = nodeList.getNeighbors(nodeList.selectedNode)

    if (!neighbors)
        return

    function makeElem(nodeJSON) {
        const elem = document.createElement("option")
        elem.innerText = `[${nodeJSON.id}] ${nodeJSON.title}`
        elem.dataset["node-id"] = elem.id
        return elem
    }

    const elems = {}
    console.log(JSON.stringify(neighbors))
    for (let x of neighbors["nodes"]) {
        /* neighbors["nodes"] is a list of json objects */
        elems[x.id] = makeElem(x)
    }

    for (let x of neighbors["edges"]) {
        /* edges is a list of lists of 2 elements: source id, target id */
        if (x[0] === x[1]) {
            // node has edge to itself, call it a predecessor
            if (!(elems[x[0]] in preList)) {
                preList.appendChild(elems[x[0]])
            }
            continue
        }

        if (x[0] === nodeList.selectedNode) {
            // selected node is source, target is successor
            sucList.appendChild(elems[x[1]])
        } else if (x[1] === nodeList.selectedNode) {
            // selected node is target, source is predecessor
            sucList.appendChild(elems[x[0]])
        }
    }
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
        nodeList.selectedNode = node.id
        titleInput.value = node["title"]
        contentInput.value = node["content"]
        // todo: move the node id display to a different element
        // todo: better way to handle excessively long titles
        titleDisplay.innerText = `[${node["id"]}] ${node["title"]}`
    } else { // invalid node
        nodeList.selectedNode = null
        titleInput.value = ""
        contentInput.value = ""
        if(nodeInput.value === "") {
            titleDisplay.innerText = "No node selected."
        } else {
            titleDisplay.innerText = "Node does not exist."
        }
    }

    await updateNodeNeighborList()
}

async function updateButtonFunc() {
    /*
    tell the server to set the selected node's attributes to the values in
    the editor boxes. if the values are already accurate, no change.
     */
    const titleInput = document.getElementById("title-input")
    const contentInput = document.getElementById("content-input")
    const nodeId = nodeList.selectedNode

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
            await updateDisplayedNode(nodeId)
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
    // todo: add a node preview window for nodeInput.onInput
    const nodeSelectButton = document.getElementById("node-select-button")
    nodeSelectButton.onclick = () => updateDisplayedNode()
    nodeInput.onkeydown = (event) => {
        if (event.key === "Enter") {
            updateDisplayedNode()
        }
    }

    const saveButton = document.getElementById("update-button")
    saveButton.onclick = updateButtonFunc
    const createButton = document.getElementById("create-button")
    createButton.onclick = createButtonFunc

    const listAllButton = document.getElementById("list-all-nodes-button")
    listAllButton.onclick = listAllButtonFunc
}

init()
