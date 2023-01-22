import {HttpRequests as requests} from "./httprequests.js";

class NodeList {
    static _nodeList = {} // dict<int, jsonData>

    _selectedNode = null // the node in the primary editor and whose neighbors are displayed
    get selectedNode() { return this._selectedNode; }
    set selectedNode(id) {
        /* does not call this.get(id), so this won't automatically get the node from the server. see this.select(id) */
        if (id === null || this.has(id)) {
            this._selectedNode = id
            return true
        } else {
            this._selectedNode = null
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
            NodeList.put(node.id, node)
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

        if (id in NodeList._nodeList) {
            return NodeList._nodeList[id]
        } else {
            await this.update(id)
            if (this.has(id)) {
                return NodeList._nodeList[id]
            } else {
                return false
            }
        }
    }

    async getNode(id) {
        /* alias for NodeList.get(id) */
        return this.get(id)
    }

    static put(id, json) {
        /*
        adds a key-value pair to the underlying dictionary: {id: json}.

        json should be a node's json object, e.g. {"id": "0", "title": "root", "content": "", "type": "root"}
         */
        if (!NodeList.validId(id))
            return false

        NodeList._nodeList[id] = json
    }

    has(id) {
        /*
        returns true if the id is in the node list. be aware that NodeList.get(id) handles this automatically.
         */
        return id in NodeList._nodeList
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

class NodeEditor {
    // so that secondary editors can see what the main selected node is
    static MainEditor = null

    get selectedNode() {
        return this.nodeList.selectedNode
    }

    constructor(editElem, nodeList, viewerElem = null) {
        /*
        takes an editor html div as input. see div with id "main-edit" for example.
         */
        this.nodeList = nodeList
        this.nodeInput = editElem.querySelector(".node-id-input")
        this.nodeSelectButton = editElem.querySelector(".node-select-button")
        this.nodeIdLabel = editElem.querySelector(".node-editor-id-label")
        this.nodeSelectButton.onclick = () => this.updateDisplayedNode()
        this.nodeInput.onkeydown = async (event) => {
            if (event.key === "Enter") {
                await this.updateDisplayedNode()
            }
        }

        this.titleInput = editElem.querySelector(".node-title-input")
        this.contentInput = editElem.querySelector(".node-content-input")
        this.saveButton = editElem.querySelector(".node-update-button")
        this.saveButton.onclick = this.updateButtonFunc.bind(this)
        this.createButton = editElem.querySelector(".node-create-button")
        this.createButton.onclick = () => this.createButtonFunc()

        if (viewerElem !== null) {
            this.upperView = viewerElem.querySelector(".node-viewer-upper-select")
            this.centerView = viewerElem.querySelector(".node-viewer-center-text")
            this.lowerView = viewerElem.querySelector(".node-viewer-lower-select")
            const unlinkUpper = viewerElem.querySelector(".unlink-upper-button")
            const unlinkLower = viewerElem.querySelector(".unlink-lower-button")
            const newParentButton = viewerElem.querySelector(".add-new-parent-button")
            const newChildButton = viewerElem.querySelector(".add-new-child-button")

            newParentButton.onclick = async () => {
                const selId = this.selectedNode
                const newId = await requests.addNode("concept", "New Node")
                await requests.linkNode(newId, selId)
                await this.updateDisplayedNode(newId)
            }

            newChildButton.onclick = async () => {
                const selId = this.selectedNode
                const newId = await requests.addNode("concept", "New Node")
                await requests.linkNode(selId, newId)
                await this.updateDisplayedNode(newId)
            }

            // todo: some sort of history thing so that you can easily undo accidental unlinks. also confirmation dialog
            unlinkUpper.onclick = this.unlinkUpper.bind(this)
            unlinkLower.onclick = this.unlinkLower.bind(this)
        }

        this.linkParentButton = editElem.querySelector(".link-parent-button")
        this.linkChildButton = editElem.querySelector(".link-child-button")

        if (this.linkParentButton)
            this.linkParentButton.onclick = async () => {
                await this.updateDisplayedNode()
                await requests.linkNode(this.nodeInput.value, NodeEditor.MainEditor.selectedNode)
                await NodeEditor.MainEditor.updateDisplayedNode()
            }

        if (this.linkChildButton)
            this.linkChildButton.onclick = async () => {
                await this.updateDisplayedNode()
                await requests.linkNode(NodeEditor.MainEditor.selectedNode, this.nodeInput.value)
                await NodeEditor.MainEditor.updateDisplayedNode()
            }
    }

    async unlinkUpper() {
        if (this.upperView.selectedIndex === -1)
            return

        const upper = this.upperView.options[this.upperView.selectedIndex].value
        await requests.unlinkNode(upper, this.selectedNode)
        await NodeEditor.MainEditor.updateDisplayedNode()
    }

    async unlinkLower() {
        if (this.lowerView.selectedIndex === -1)
            return

        console.log(this.lowerView.options)
        console.log(this.lowerView.selectedIndex)
        const lower = this.lowerView.options[this.lowerView.selectedIndex].value
        await requests.unlinkNode(this.selectedNode, lower)
        await NodeEditor.MainEditor.updateDisplayedNode()
    }

    async updateDisplayedNode(id=null) {
        /*
        display the node specified by `id` param. if id is null, display node specified by
        the "node-input" input box.

        handles all things necessary to change the displayed node.
         */

        if (id !== null) {
            this.nodeList.selectedNode = id
            this.nodeInput.value = id
        }

        if (this.nodeInput.value === "0") { // can't edit root node
            this.titleInput.setAttribute("disabled", "")
            this.contentInput.setAttribute("disabled", "")
        } else {
            this.titleInput.removeAttribute("disabled")
            this.contentInput.removeAttribute("disabled")
        }

        const node = await this.nodeList.get(this.nodeInput.value)
        if (node) {
            this.nodeIdLabel.innerText = node.id
            this.nodeList.selectedNode = node.id
            this.titleInput.value = node["title"]
            this.contentInput.value = node["content"]
            // todo: move the node id display to a different element
            // todo: better way to handle excessively long titles
            if (this.centerView) {
                this.centerView.innerText = `[#${node["id"]}] ${node["title"]}`
            }
        } else { // invalid node
            this.nodeIdLabel.innerText = "None"
            this.nodeList.selectedNode = null
            this.titleInput.value = ""
            this.contentInput.value = ""
            if (this.centerView) {
                if (this.nodeInput.value === "") {
                    this.centerView.innerText = "No node selected."
                } else {
                    this.centerView.innerText = "Node does not exist."
                }
            }
        }

        await this.updateNodeNeighborList()
    }

    async updateButtonFunc() {
        /*
        tell the server to set the selected node's attributes to the values in
        the editor boxes. if the values are already accurate, no change.
         */
        // todo: check that this.selectedNode is the same as this.nodeInput.value
        const nodeId = this.selectedNode

        const node = await this.nodeList.get(nodeId)
        if (!node) {
            console.error(`Cannot update node: this.nodeList.get(nodeId) returned ${node}.`)
        }
        else {
            let u = false
            if (this.titleInput.value !== node.title) {
                u = true
                await requests.updateNode(nodeId, "title", this.titleInput.value)
            }

            if (this.contentInput.value !== node.content) {
                u = true
                await requests.updateNode(nodeId, "content", this.contentInput.value)
            }

            if (u) {
                await this.nodeList.update(nodeId)
                await this.updateDisplayedNode(nodeId)
            }
        }
    }

    async createButtonFunc(title=null, content=null) {
        /*
        creates a new node using the title and content from their respective input boxes. then displays the new node.

        returns the new node's id
         */

        // todo: support for user-specified node type
        const newNodeId =
            await requests.addNode("concept", title || this.titleInput.value, content || this.contentInput.value)
        await this.updateDisplayedNode(newNodeId)
        this.titleInput.focus()
        return newNodeId
    }

    async updateNodeNeighborList() {
        /*
        updates the lists that display the selected node's predecessors and successors.
         */
        if (!this.upperView || !this.lowerView)
            return

        this.upperView.innerHTML = "" // removes all child elements
        this.lowerView.innerHTML = "" // removes all child elements

        const neighbors = await this.nodeList.getNeighbors(this.nodeList.selectedNode)

        if (!neighbors)
            return

        function makeElem(nodeJSON) {
            const elem = document.createElement("option")
            elem.innerText = `[#${nodeJSON.id}] ${nodeJSON.title}`
            elem.value = nodeJSON.id
            return elem
        }

        const elems = {}
        for (let x of neighbors["nodes"]) {
            /* neighbors["nodes"] is a list of json objects */
            elems[x.id] = makeElem(x)
        }

        const dblClickEvent = (event) => NodeEditor.MainEditor.updateDisplayedNode(event.target.value)
        function appendElem(view, id) {
            const elem = elems[id].cloneNode(true)
            elem.ondblclick = dblClickEvent
            view.appendChild(elem)
        }

        let circle = false
        for (let x of neighbors["edges"]) {
            /* edges is a list of lists of 2 elements: source id, target id */

            if (x[0] === x[1]) {
                if (circle) continue
                // so that edges to itself won't put two copies in this.lowerView
                appendElem(this.upperView, x[0])
                appendElem(this.lowerView, x[0])
                circle = true
                continue
            }

            if (x[0] === this.nodeList.selectedNode) {
                // selected node is source, target is successor
                appendElem(this.lowerView, x[1])
            } else if (x[1] === this.nodeList.selectedNode) {
                // selected node is target, source is predecessor
                appendElem(this.upperView, x[0])
            }
        }
    }
}

async function init() {
    const nodeList = new NodeList()

    const mainEditElem = document.getElementById("main-editor")
    const nodeViewer = document.getElementById("node-viewer")
    const mainEdit = new NodeEditor(mainEditElem, nodeList, nodeViewer)

    NodeEditor.MainEditor = mainEdit
    await mainEdit.nodeList.update(0) // retrieve root node from server
    await mainEdit.updateDisplayedNode(0)

    // todo: add a nodeUpdated event, and call it when the secondary editor updates a node. it'll
    //  update everything in the main editor (i.e. node viewer's titles) to reflect the new value
    const secNodeList = new NodeList()
    const secEditElem = document.getElementById("secondary-editor")
    const secEdit = new NodeEditor(secEditElem, secNodeList)

    const updateSec = (event) => {
        const sel = event.target
        secEdit.updateDisplayedNode(sel.options[sel.selectedIndex].value)
    }

    mainEdit.upperView.addEventListener("change", updateSec)
    mainEdit.lowerView.addEventListener("change", updateSec)
}

init()
