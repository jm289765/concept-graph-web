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
        /*
        adds nodes from nodeJSON to the NodeList.

        nodeJSON can be either a dict with a "nodes" key or a list of node jsons.

        returns a list of ids of nodes that were loaded from nodeJSON.
         */
        let njson = nodeJSON
        if ("nodes" in nodeJSON) {
            njson = nodeJSON["nodes"]
        }

        const ret = []
        for (let node of njson) {
            NodeList.put(node.id, node)
            ret.push(node.id)
        }
        return ret
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

    async createNode(type, title, content="", tags="", parent=0) {
        /*
        creates a new node and sends an addNode request to the server.

        returns the id of the new node.
         */
        const newNodeJSON = await requests.addNode(type, title, content, tags, parent)
        return NodeList.nodesFromJSON(newNodeJSON)[0]
    }

    async updateNode(id, attr, val) {
        const updatedNodeJSON = await requests.updateNode(id, attr, val)
        return NodeList.nodesFromJSON(updatedNodeJSON)[0]
    }
}

class SearchBox {
    constructor(searchElem, parent) {
        /* searchElem is the search box's <label> element. it should have a child with the
        * "search-input-wrapper" class and an <input> child with the "node-search-input" class.
        *
        * parent should be a NodeEditor object. */
        if (searchElem === undefined || searchElem === null) {
            // element does not exist
            return
        }

        this.maxResultsAmount = 10
        this.inputWrapper = searchElem.querySelector(".search-input-wrapper")
        this.inputBox = searchElem.querySelector(".node-search-input")
        this.searchResultsElem = document.createElement("div")
        this.searchResults = {}

        this.inputBox.oninput = () => this.updateHandler()
        this.inputBox.onfocus = () => this.showSearchResults()
        this.searchResultsElem.classList.add("search-results-list")
        this.hideSearchResults()
        this.inputWrapper.appendChild(this.searchResultsElem)

        if (parent !== undefined && parent !== null) {
            this.nodeEditor = parent
        }

        // hide search results when clicking outside it
        document.addEventListener('click', (event) => {
            // this event doesn't fire when a disabled element is clicked. so it doesn't
            // always work when you have the root node loaded in a node editor.
            // it's difficult to fix. you could try using readonly instead of disabled,
            // but that allows users to still select the input boxes. also, the type select box
            // would need to have all of its options disabled too.
            if (!this.searchResultsVisible()) {
                return
            }

            const withinBoundaries = event.composedPath().includes(this.inputWrapper)

            if (!withinBoundaries) {
                this.hideSearchResults()
            }
        })
    }

    async selectSearchItem(event) {
        await this.nodeEditor.updateDisplayedNode(event.target.dataset["id"])
        this.hideSearchResults()
    }

    appendSearchResultItem(id, text) {
        const itemText = `[${id}] ${text}`
        if (id in this.searchResults) {
            this.searchResults[id].innerText = itemText
            return
        }

        if (Object.keys(this.searchResults).length >= this.maxResultsAmount) {
            return
        }

        const newItem = document.createElement("div")
        newItem.classList.add("search-results-item")
        newItem.innerText = itemText
        newItem.setAttribute("title", itemText)
        newItem.dataset["id"] = id

        newItem.onclick = (event) => this.selectSearchItem(event)
        this.searchResults[id] = newItem
        this.searchResultsElem.appendChild(newItem)
    }

    async updateSearchResults() {
        const res = await requests.search(this.inputBox.value)
        // res is list of dicts of {id: x, title: y}

        // remove previous results
        this.searchResultsElem.innerHTML = ""
        this.searchResults = []

        for (let x of res) {
            this.appendSearchResultItem(x.id, x.title)
        }

        this.showSearchResults()
    }

    updateHandler() {
        const val = this.inputBox.value
        const p = async () => {
            if (val === this.inputBox.value) {
                // value has not changed
                await this.updateSearchResults()
            }
        }
        // only update search results if value has not changed for 0.5 seconds
        // this reduces the amount of requests made by a lot
        setTimeout(p.bind(this), 500)
    }

    searchResultsVisible() {
        /* returns true if search results are visible, false if not visible */
        return this.searchResultsElem.style.display !== "none"
    }

    hideSearchResults() {
        this.searchResultsElem.style.display = "none"
    }

    showSearchResults() {
        this.searchResultsElem.style.display = "block"
    }
}

class NodeEditor {
    // there's probably a better way to do this. maybe a NodeViewer class with two NodeEditor objects?
    static MainEditor = null
    static SecondaryEditor = null

    get selectedNode() {
        /* id of the node currently selected by this NodeEditor */
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
        this.nodeInput.onblur = () => this.updateDisplayedNode()
        this.nodeInput.onkeydown = async (event) => {
            if (event.key === "Enter") {
                await this.updateDisplayedNode()
            }
        }

        this.searchBox = new SearchBox(editElem.querySelector(".search-input-label"), this)
        this.titleInput = editElem.querySelector(".node-title-input")
        this.tagsInput = editElem.querySelector(".node-tags-input")
        this.typeSelect = editElem.querySelector(".node-type-select")
        this.contentInput = editElem.querySelector(".node-content-input")
        this.saveButton = editElem.querySelector(".node-save-button")
        this.saveButton.onclick = () => this.saveButtonFunc()
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
                const newId = await nodeList.createNode("concept", "New Node")
                await requests.linkNode(newId, selId)
                await this.updateDisplayedNode(newId)
            }

            newChildButton.onclick = async () => {
                const selId = this.selectedNode
                const newId = await nodeList.createNode("concept", "New Node")
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

        // in case there are unsaved changes. updateAfter=false prevents an infinite loop.
        await this.saveButtonFunc(false)

        if (this.nodeList.selectedNode !== null && this === NodeEditor.MainEditor)
            await viewHistory.add(this.nodeList.selectedNode)

        if (id !== null) {
            this.nodeList.selectedNode = id
            this.nodeInput.value = id
        }

        if (this.nodeInput.value === "0") { // can't edit root node
            this.titleInput.setAttribute("disabled", "")
            this.tagsInput.setAttribute("disabled", "")
            this.typeSelect.setAttribute("disabled", "")
            this.typeSelect.options[this.typeSelect.options.length - 1].removeAttribute("disabled")
            this.contentInput.setAttribute("disabled", "")
            this.saveButton.setAttribute("disabled", "")
            // same for update button, tags list, and type
        } else {
            this.titleInput.removeAttribute("disabled")
            this.tagsInput.removeAttribute("disabled")
            this.typeSelect.removeAttribute("disabled")
            this.typeSelect.options[this.typeSelect.options.length - 1].setAttribute("disabled", "")
            this.contentInput.removeAttribute("disabled")
            this.saveButton.removeAttribute("disabled")
        }

        const node = await this.nodeList.get(this.nodeInput.value)
        if (node) {
            this.nodeIdLabel.innerText = node.id
            this.nodeList.selectedNode = node.id
            this.titleInput.value = node["title"]
            this.tagsInput.value = node["tags"]
            this.typeSelect.value = node["type"]
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
            this.tagsInput.value = ""
            this.typeSelect.value = "concept"
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

    async saveButtonFunc(updateAfter=true) {
        /*
        tell the server to set the selected node's attributes to the values in
        the editor boxes. if the values are already accurate, no change.
         */
        // todo: check that this.selectedNode is the same as this.nodeInput.value
        const nodeId = this.selectedNode

        const node = await this.nodeList.get(nodeId)
        if (!node)
            return

        let u = false
        if (this.titleInput.value !== node.title) {
            u = true
            await this.nodeList.updateNode(nodeId, "title", this.titleInput.value)
        }

        if (this.contentInput.value !== node.content) {
            u = true
            await this.nodeList.updateNode(nodeId, "content", this.contentInput.value)
        }

        if (this.tagsInput.value !== node["tags"]) {
            u = true
            await this.nodeList.updateNode(nodeId, "tags", this.tagsInput.value)
        }

        const type = this.typeSelect.options[this.typeSelect.selectedIndex].value
        if (type !== node.type) {
            u = true
            await this.nodeList.updateNode(nodeId, "type", type)
        }

        if (u) {
            await this.nodeList.update(nodeId)
            if (updateAfter)
                await NodeEditor.MainEditor.updateDisplayedNode() // update title in viewer list

            // todo: if both editors have the same node, make sure they both update
            //  e.g. if both have node 7 selected, and you update content in one, the other
            //  content should update too
        }
    }

    async createButtonFunc(title=null, content=null) {
        /*
        creates a new node using the title and content from their respective input boxes. then displays the new node.

        returns the new node's id
         */

        let type = this.typeSelect.options[this.typeSelect.selectedIndex].value
        if (type === "root") { type = "concept" }
        const ti = title || this.titleInput.value
        const co = content || this.contentInput.value
        const tags = this.tagsInput.value
        const newNodeId = await this.nodeList.createNode(type, ti, co, tags, this.selectedNode || 0)
        await this.updateDisplayedNode(newNodeId)
        if (this !== NodeEditor.MainEditor)
            await NodeEditor.MainEditor.updateDisplayedNode()
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
            const elemText = `[#${nodeJSON.id}] ${nodeJSON.title}`
            elem.innerText = elemText
            elem.value = nodeJSON.id
            elem.setAttribute("title", elemText)
            // todo: add a class based on nodeJSON.type, and add css to color them
            return elem
        }

        const elems = {}
        for (let x of neighbors["nodes"]) {
            /* neighbors["nodes"] is a list of json objects */
            elems[x.id] = makeElem(x)
        }

        const dblClickEvent = (event) => NodeEditor.MainEditor.updateDisplayedNode(event.target.value)
        const clickEvent = (event) => {NodeEditor.SecondaryEditor.updateDisplayedNode(event.target.value)}
        function appendElem(view, id) {
            const elem = elems[id].cloneNode(true)
            elem.ondblclick = dblClickEvent
            // this onclick makes updateDisplayedNode happen twice when a node is clicked, but it's necessary
            // to keep the 'change' event listener for the <select> elements to catch arrow keys
            elem.onclick = clickEvent
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

            // use == in case one id is a string and the other is a number
            if (x[0] == this.nodeList.selectedNode) {
                // selected node is source, target is successor
                appendElem(this.lowerView, x[1])
            } else if (x[1] == this.nodeList.selectedNode) {
                // selected node is target, source is predecessor
                appendElem(this.upperView, x[0])
            }
        }
    }
}

let viewHistory
async function init() {
    const nodeList = new NodeList()

    const mainEditElem = document.getElementById("main-editor")
    const nodeViewer = document.getElementById("node-viewer")
    const mainEdit = new NodeEditor(mainEditElem, nodeList, nodeViewer)

    document.getElementById("view-history-select").onchange = (event) => {
        NodeEditor.MainEditor.updateDisplayedNode(event.target.options[event.target.selectedIndex].value)
    }

    viewHistory = {
        // viewHistory has to be set up before any node editor gets updated or displays a node
        elem: document.getElementById("view-history-select"),
        nodeList: mainEdit.nodeList, // hacky way to do this
        makeOption: async (id) => {
            const opt = document.createElement("option")
            const node = await viewHistory.nodeList.get(id)
            opt.value = node.id
            opt.innerText = `[${node.id}] ${node.title}`
            return opt
        },
        add: async (id) => {
            if (viewHistory.elem.children.length > 100)
                viewHistory.elem.firstChild.remove()

            if (!viewHistory.elem.firstChild)
                viewHistory.elem.appendChild(await viewHistory.makeOption(id))
            else {
                // in case one of these is an int and the other is a string.
                if (viewHistory.elem.lastChild.value == id)
                    return
                //viewHistory.elem.insertBefore(await viewHistory.makeOption(id), viewHistory.elem.firstChild)
                viewHistory.elem.appendChild(await viewHistory.makeOption(id))
            }
        }
    }

    NodeEditor.MainEditor = mainEdit
    await mainEdit.nodeList.update(0) // retrieve root node from server
    await mainEdit.updateDisplayedNode(0)

    // todo: add a nodeUpdated event, and call it when the secondary editor updates a node. it'll
    //  update everything in the main editor (i.e. node viewer's titles) to reflect the new value
    const secNodeList = new NodeList()
    const secEditElem = document.getElementById("secondary-editor")
    NodeEditor.SecondaryEditor = new NodeEditor(secEditElem, secNodeList)

    const updateSec = (event) => {
        const sel = event.target
        NodeEditor.SecondaryEditor.updateDisplayedNode(sel.options[sel.selectedIndex].value)
    }
    const enterEvent = (event) => {
        if (event.key === "Enter") {
            const sel = event.target
            NodeEditor.MainEditor.updateDisplayedNode(sel.options[sel.selectedIndex].value)
        }
    }

    NodeEditor.MainEditor.upperView.addEventListener("change", updateSec)
    NodeEditor.MainEditor.lowerView.addEventListener("change", updateSec)
    NodeEditor.MainEditor.upperView.addEventListener("keydown", enterEvent)
    NodeEditor.MainEditor.lowerView.addEventListener("keydown", enterEvent)

}

init()
