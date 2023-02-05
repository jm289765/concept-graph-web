import {HttpRequests as requests} from "./httprequests.js";

class NodeList {
    static _nodeList = {} // dict<int, jsonData>

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

    static async get(id="0") {
        /*
        returns json object of node with given id.

        if the nodeList doesn't have the node, it will attempt to retrieve it from the server.
        if the server doesn't have the node, or an invalid id is provided, this will return false.
         */

        if (!NodeList.validId(id))
            return false

        const _id = id.toString()
        if (_id in NodeList._nodeList) {
            return NodeList._nodeList[_id]
        } else {
            await this.update(_id)
            if (NodeList.has(_id)) {
                return NodeList._nodeList[_id]
            } else {
                return false
            }
        }
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

    static has(id) {
        /*
        returns true if the id is in the node list. be aware that NodeList.get(id) handles this automatically.
        This still returns false if the node exists on the server but hasn't yet been requested or downloaded.
         */
        return id in NodeList._nodeList
    }

    static async update(id) {
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

    static async delete(id) {
        // todo: make sure to remove deleted nodes from nodeList
        throw new ErrorEvent("'NodeList.delete' not implemented.")
    }

    static async getNeighbors(id) {
        /*
        get predecessors and successors of node 'id'. returns json object with a "nodes" and an "edges" attribute.

        "nodes" is a list of node JSON objects, so it's not just a list of ids.

        "edges" is a list of pairs of ids: [source, target]
        */
        if (!NodeList.validId(id)) {
            return false
        }

        const n = await requests.getNeighbors(id)
        NodeList.nodesFromJSON(n)

        return n
    }

    static async createNode(type, title, content="", tags="", parent=0) {
        /*
        creates a new node and sends an addNode request to the server.

        returns the id of the new node.
         */
        const newNodeJSON = await requests.addNode(type, title, content, tags, parent)
        return NodeList.nodesFromJSON(newNodeJSON)[0]
    }

    static async updateNode(id, attr, val) {
        const updatedNodeJSON = await requests.updateNode(id, attr, val)
        return NodeList.nodesFromJSON(updatedNodeJSON)[0]
    }
}

class SearchBox {
    constructor(searchElem, editors) {
        /* searchElem is the search box's container element. it should have a child with the
        * "search-container-input" class and an <input> child with the "search-input" class.
        *
        * editors: list of NodeEditors that search results can be opened in */

        this.editors = editors
        this.container = searchElem
        this.inputContainer = searchElem.querySelector(".search-container-input")
        this.inputBox = searchElem.querySelector(".search-input")

        this.searchResultsElem = document.createElement("div")
        this.searchResultsElem.classList.add("search-container-results")
        this.inputContainer.appendChild(this.searchResultsElem)

        this.searchResultsList = new UIList("", this.searchResultsElem, "rebeccapurple")

        this.inputBox.oninput = () => this.updateHandler()
        this.inputBox.onfocus = () => this.showSearchResults()
        this.hideSearchResults()

        // hide search results after opening one in an editor
        this.searchResultsElem.addEventListener("click", (evt) => {
            if (evt.target.classList.contains("viewer-item-button-editor")) {
                this.hideSearchResults()
            }
        })

        // hide search results when clicking outside results list
        document.addEventListener('click', (event) => {
            // this event doesn't fire when a disabled element is clicked. so it doesn't
            // always work when you have the root node loaded in a node editor.
            // it's difficult to fix. you could try using readonly instead of disabled,
            // but that allows users to still select the input boxes. also, the type select box
            // would need to have all of its options disabled too.
            if (!this.searchResultsVisible()) {
                return
            }

            const withinBoundaries = event.composedPath().includes(this.inputContainer)

            if (!withinBoundaries) {
                this.hideSearchResults()
            }
        })
    }

    appendSearchResultItem(data) {
        /* data: a node data object from NodeList */
        const newItem = new ViewerItem(data, this.editors)
        this.searchResultsList.addElem(newItem)
    }

    async updateSearchResults() {
        const res = await requests.search(this.inputBox.value)
        // res is list of dicts of {id: x, title: y}

        this.searchResultsList.clear()

        for (let x of res) {
            this.appendSearchResultItem(x)
        }

        this.showSearchResults()
    }

    updateHandler() {
        // aka debouncer
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

class NodeViewer {
    /* viewerElem: the HTMLElement that contains this nodeViewer

    editors: list of NodeEditors that this viewer's items can be opened in.

    title: title of this NodeViewer
     */
    constructor(viewerElem, editors, title) {
        this.viewerElem = viewerElem
        this.editors = editors

        this.catContainer = new UIList(title, viewerElem, "rebeccapurple")
        const p = new UIList("Parents", this.catContainer.elem, "lavender")
        const c = new UIList("Children", this.catContainer.elem, "lavender")
        this.catContainer.addElem(p.elem)
        this.catContainer.addElem(c.elem)

        this.categories = {
            "parents": p,
            "children": c
        }
    }

    async updateDisplay(id) {
        const addItem = (category, node) => {
            const i = new ViewerItem(node, this.editors)
            this.categories[category].addElem(i)
        }

        const neighbors = await NodeList.getNeighbors(id)

        this.clearDisplay()

        const nodes = {}
        for (let x of neighbors["nodes"]) {
            nodes[x["id"]] = x
        }

        let circle = false
        for (let x of neighbors["edges"]) {
            // edges is a list of lists of 2 elements: source id, target id

            if (x[0] === x[1]) {
                if (circle) continue
                // so that edges to itself won't put two copies in this.lowerView
                addItem("parents", nodes[x[0]])
                addItem("children", nodes[x[0]])
                circle = true
                continue
            }

            // use == in case one id is a string and the other is a number
            if (x[0] == id) {
                // selected node is source, target is successor
                addItem("children", nodes[x[1]])
            } else if (x[1] == id) {
                // selected node is target, source is predecessor
                addItem("parents", nodes[x[0]])
            }
        }
    }

    clearDisplay() {
        for (let c of Object.keys(this.categories)) {
            this.categories[c].clear()
        }
    }
}

class NodeEditor {
    // there's probably a better way to do this. maybe a NodeViewer class with two NodeEditor objects?
    static MainEditor = null
    static SecondaryEditor = null

    constructor(editElem) {
        /*
        takes an editor html div as input. see div with id "main-edit" for example.
         */
        this._selectedNode = null
        this.editElem = editElem

        this.nodeInput = editElem.querySelector(".editor-input-id")
        this.titleInput = editElem.querySelector(".editor-input-title")
        this.tagsInput = editElem.querySelector(".editor-input-tags")
        this.contentInput = editElem.querySelector(".editor-input-content")

        this.typeSelect = editElem.querySelector(".editor-select-type")

        this.nodeSelectButton = editElem.querySelector(".editor-button-select")
        this.saveButton = editElem.querySelector(".editor-button-save")
        this.createButton = editElem.querySelector(".editor-button-create")
        this.linkParentButton = editElem.querySelector(".editor-button-linkparent")
        this.linkChildButton = editElem.querySelector(".editor-button-linkchild")

        this.nodeSelectButton.onclick = async () => await this.setSelectedNode(this.nodeInput.value)
        this.nodeInput.onblur = async () => await this.setSelectedNode(this.nodeInput.value)
        this.nodeInput.onkeydown = async (event) => {
            if (event.key === "Enter") {
                await this.setSelectedNode(this.nodeInput.value)
            }
        }

        this.saveButton.onclick = () => this.saveButtonFunc()
        this.createButton.onclick = () => this.createButtonFunc()

        if (this.linkParentButton)
            this.linkParentButton.onclick = async () => {
                await requests.linkNode(this.nodeInput.value, NodeEditor.MainEditor.selectedNode)
                await this.updateDisplayedNode() // is this necessary? idk.
                await NodeEditor.MainEditor.updateDisplayedNode()
            }

        if (this.linkChildButton)
            this.linkChildButton.onclick = async () => {
                await requests.linkNode(NodeEditor.MainEditor.selectedNode, this.nodeInput.value)
                await this.updateDisplayedNode()
                await NodeEditor.MainEditor.updateDisplayedNode()
            }
    }

    addEventListener(type, callback, options) {
        /* NodeEditor objects have a "nodeupdate" event that fires whenever the selected node
        * is changed. for nodeupdate handlers, event.detail gives you the new id. */
        this.editElem.addEventListener(type, callback, options)
    }

    removeEventListener(type, callback, options) {
        this.editElem.removeEventListener(type, callback, options)
    }

    get selectedNode() {
        /* id of the node currently selected by this NodeEditor */
        return this._selectedNode
    }

    async setSelectedNode(id) {
        /* sets id of currently selected node and calls the nodeupdate event */

        // todo: check if id is invalid first, and make updateDisplayedNode check with NodeList.has() instead
        //  of .get()
        if (id == this.selectedNode) // id can be either int or str, so use == instead of ===
            return

        // in case there are unsaved changes. updateAfter=false bc we'll update in a moment.
        await this.saveButtonFunc(false)

        this._selectedNode = id
        const x = await this.updateDisplayedNode()
        if (!x)
            this._selectedNode = null

        const ev = new CustomEvent("nodeupdate", {detail: this.selectedNode, bubbles: false})
        this.editElem.dispatchEvent(ev)
    }

    async updateDisplayedNode() {
        /*
        display the currently selected node. this function is automatically called when you set
        NodeEditor.selectedNode.

        returns true if the display is updated, false if it isn't.
         */

        const id = this.selectedNode

        try {
            if (id === null || id === undefined) {
                this.titleInput.value = ""
                this.titleInput.setAttribute("title", "")
                this.tagsInput.value = ""
                this.typeSelect.value = "null"
                this.contentInput.value = ""
                return true
            }

            await viewHistory.add(id)

            this.nodeInput.value = id

            if (this.nodeInput.value === "0") { // can't edit root node
                this.titleInput.setAttribute("disabled", "")
                this.titleInput.setAttribute("title", "")
                this.tagsInput.setAttribute("disabled", "")
                this.typeSelect.setAttribute("disabled", "")
                this.typeSelect.options[this.typeSelect.options.length - 1].removeAttribute("disabled")
                this.contentInput.setAttribute("disabled", "")
                this.saveButton.setAttribute("disabled", "")
            } else {
                this.titleInput.removeAttribute("disabled")
                this.tagsInput.removeAttribute("disabled")
                this.typeSelect.removeAttribute("disabled")
                this.typeSelect.options[this.typeSelect.options.length - 1].setAttribute("disabled", "")
                this.contentInput.removeAttribute("disabled")
                this.saveButton.removeAttribute("disabled")
            }

            const node = await NodeList.get(id)
            if (node) {
                const dName = getDisplayName(node)
                this.titleInput.value = dName
                this.titleInput.setAttribute("title", dName)
                this.tagsInput.value = node["tags"]
                this.typeSelect.value = node["type"]
                this.contentInput.value = node["content"]
            } else { // invalid node
                this.titleInput.value = ""
                this.tagsInput.value = ""
                this.typeSelect.value = "null"
                this.contentInput.value = ""
            }

            if (this.viewer) {
                await this.viewer.updateDisplay(id)
            }
            return true
        } catch (e) {
            console.log(e)
        }
    }

    async saveButtonFunc(updateAfter=true) {
        /*
        tell the server to set the selected node's attributes to the values in
        the editor boxes. if the values are already accurate, no change.
         */
        // todo: check that this.selectedNode is the same as this.nodeInput.value
        try {
            const nodeId = this.selectedNode

            const node = await NodeList.get(nodeId)
            if (!node)
                return

            let u = false
            if (this.titleInput.value !== getDisplayName(node)) {
                let realTitle = this.titleInput.value
                // hacky way to do this. shouldn't need to know that display name starts with "["
                // and shouldn't need to know that the display name only adds text before the first space.
                if (realTitle.startsWith("[")) {
                    const firstSpace = realTitle.indexOf(" ")
                    realTitle = realTitle.slice(firstSpace + 1)
                }

                if (realTitle !== node.title) {
                    u = true
                    await NodeList.updateNode(nodeId, "title", realTitle)
                }
            }

            if (this.contentInput.value !== node.content) {
                u = true
                await NodeList.updateNode(nodeId, "content", this.contentInput.value)
            }

            if (this.tagsInput.value !== node["tags"]) {
                u = true
                await NodeList.updateNode(nodeId, "tags", this.tagsInput.value)
            }

            const type = this.typeSelect.options[this.typeSelect.selectedIndex].value
            if (type !== node.type) {
                u = true
                await NodeList.updateNode(nodeId, "type", type)
            }

            if (u) {
                await NodeList.update(nodeId)
                if (updateAfter)
                    await NodeEditor.MainEditor.updateDisplayedNode() // update title in viewer list

                // todo: if both editors have the same node, make sure they both update
                //  e.g. if both have node 7 selected, and you update content in one, the other
                //  content should update too
            }
        } catch (e) {
            console.log(e)
        }
    }

    async createButtonFunc(title=null, content=null) {
        /*
        creates a new node using the title and content from their respective input boxes. then displays the new node.

        returns the new node's id
         */
        try {
            let type = this.typeSelect.options[this.typeSelect.selectedIndex].value
            if (type === "root") {
                type = "concept"
            }
            const ti = title || this.titleInput.value
            const co = content || this.contentInput.value
            const tags = this.tagsInput.value
            const newNodeId = await NodeList.createNode(type, ti, co, tags, this.selectedNode || 0)
            await this.setSelectedNode(newNodeId)
            if (this !== NodeEditor.MainEditor)
                await NodeEditor.MainEditor.updateDisplayedNode()
            return newNodeId
        } catch (e) {
            console.log(e)
        }
    }
}

class ViewHistory {
    constructor(container, editors) {
        this.container = container
        this.editors = editors
        this._lastAdded = null

        this.titleElem = document.createElement("div")
        this.titleElem.classList.add("history-text-title")
        this.titleElem.innerText = "Previously Viewed"
        this.container.appendChild(this.titleElem)

        this.listContainer = document.createElement("div")
        this.listContainer.classList.add("history-container")
        this.container.appendChild(this.listContainer)

        this.list = new UIList("", this.listContainer, "rebeccapurple")
    }

    /* adds node with given id to the view history list */
    async add(id) {
        if (id == this._lastAdded) {
            return
        }

        const node = await NodeList.get(id)
        if (node) {
            const listItem = new ViewerItem(node, this.editors)
            this.list.addElem(listItem)
            this.list.truncate(100)
            this.container.scrollTop = this.container.scrollHeight
            this._lastAdded = id
        }
    }
}

class UIList {
    /* title: string that's displayed as the list's title
    *
    * container: the HTMLElement that contains this UIList
    *
    * sideColor: color to be shown along the left side of the list items */
    constructor(title, container, sideColor="rebeccapurple") {
        this.title = title
        this.elem = document.createElement("div")
        this.elem.classList.add("uilist-container")
        this.elem.title = this.title
        this.elem.style.backgroundColor = sideColor
        container.appendChild(this.elem)

        this.titleElem = document.createElement("div")
        this.titleElem.classList.add("uilist-text-title")
        this.titleElem.innerHTML = this.title
        this.elem.appendChild(this.titleElem)

        this.innerList = document.createElement("div")
        this.innerList.classList.add("uilist-container-inner")
        this.elem.appendChild(this.innerList)

        this.titleElem.addEventListener("click", (evt) => {
            if (evt.target === this.titleElem) // so that we don't double toggle
                this.toggleVisibility()
        })
        this.elem.addEventListener("click", (evt) => {
            if (evt.target === this.elem)
                this.toggleVisibility()
        })
    }

    /* adds an element to this UIList's display

    elem: an HTMLElement or a UIList or a ViewerItem */
    addElem(elem) {
        if (elem instanceof UIList) {
            this.innerList.appendChild(elem.elem)
        } else if (elem instanceof ViewerItem) {
            this.innerList.appendChild(elem.elem)
        } else {
            this.innerList.appendChild(elem)
        }
    }

    /* clears the UIList so that it no longer contains or displays any elements. */
    clear() {
        this.innerList.innerHTML = ""
    }

    /* shortens the UIList so that it has, at most, maxSize items. Removes from the front of the list,
    i.e. removes the earliest items that were added. */
    truncate(maxSize) {
        if (maxSize === 0) {
            this.clear()
            return
        }

        while (this.innerList.children.length > maxSize) {
            this.innerList.removeChild(this.innerList.firstChild)
        }
    }

    /* toggles visibility of this list. The list's title remains visible. */
    toggleVisibility() {
        if (this.innerList.style.display === "none")
            this.innerList.style.display = "block"
        else
            this.innerList.style.display = "none"
    }
}

class ViewerItem {
    /* data: a node json object
    *
    * editors: list of NodeEditors that this ViewerItem should link to */
    constructor(data, editors) {
        this.elem = document.createElement("div")
        this.elem.classList.add("viewer-item")
        this.elem.dataset["id"] = data["id"]
        this.elem.dataset["nodetype"] = data["type"]

        this.textElem = document.createElement("div")
        this.textElem.classList.add("viewer-item-text")
        let dName = getDisplayName(data)
        this.textElem.innerHTML = dName
        this.textElem.title = dName
        this.elem.appendChild(this.textElem)

        this.buttonContainer = document.createElement("div")
        this.buttonContainer.classList.add("viewer-item-container-buttons")
        this.elem.appendChild(this.buttonContainer)

        if (editors) {
            for (let idx in editors) {
                // in javascript, array indices are strings. so we do Number(idx)
                const button = this.makeEditorButton(Number(idx) + 1, editors[idx])
                this.buttonContainer.appendChild(button)
            }
        }
    }

    makeEditorButton(editorID, editor) {
        // make button elem, add to a button container
        const button = document.createElement("div")
        button.classList.add("viewer-item-button-editor")
        button.innerText = editorID
        button.title = `Open in Editor ${editorID}`

        button.addEventListener("click", (evt) => {
            editor.setSelectedNode(this.elem.dataset["id"])
        })

        return button
    }
}

function getDisplayName(nodeObj) {
    /* nodeObj: an object with attributes for "title" and "id".

    return: formatted display name for the given node, e.g. "[#0] root"
     */
    return `[#${nodeObj["id"]}] ${nodeObj["title"]}`
}

let viewHistory
async function init() {
    const mainEditElem = document.getElementById("editor-1")
    const secEditElem = document.getElementById("editor-2")
    const searchElem = document.getElementById("search-container")
    const viewerElem = document.getElementById("viewers-container")
    const historyElem = document.getElementById("history-container")

    const mainEdit = new NodeEditor(mainEditElem)
    const secEdit = new NodeEditor(secEditElem)

    NodeEditor.MainEditor = mainEdit
    NodeEditor.SecondaryEditor = secEdit
    const editors = [mainEdit, secEdit]

    // viewHistory has to be set up before any node editor gets updated or displays a node
    if (historyElem) {
        viewHistory = new ViewHistory(historyElem, editors)
    }

    if (viewerElem) {
        for (let idx in editors) {
            const viewerContainer = document.createElement("div")
            viewerContainer.classList.add("viewer-container")
            viewerElem.appendChild(viewerContainer)
            const title = `Editor ${Number(idx) + 1}`

            const viewer = new NodeViewer(viewerContainer, editors, title)
            editors[idx].addEventListener("nodeupdate", (e) => {
                viewer.updateDisplay(e.detail)
            })
        }
    }

    if (searchElem) {
        const search = new SearchBox(searchElem, editors)
    }

    await NodeList.update(0) // retrieve root node from server
    await mainEdit.setSelectedNode(0)
    await secEdit.setSelectedNode(null)

    /*
    // todo: change all this to use nodeupdate events, then get rid of NodeEditor.MainEditor and SecondaryEditor
    const updateSec = (event) => {
        const sel = event.target
        NodeEditor.SecondaryEditor.updateDisplayedNode(sel.options[sel.selectedIndex].value)
    }
    const enterEvent = (event) => {
        // for keyboard navigation of viewer's parents and children lists
        if (event.key === "Enter") {
            const sel = event.target
            NodeEditor.MainEditor.updateDisplayedNode(sel.options[sel.selectedIndex].value)
        }
    }

    NodeEditor.MainEditor.viewerElem.upperView.addEventListener("change", updateSec)
    NodeEditor.MainEditor.viewerElem.lowerView.addEventListener("change", updateSec)
    NodeEditor.MainEditor.viewerElem.upperView.addEventListener("keydown", enterEvent)
    NodeEditor.MainEditor.viewerElem.lowerView.addEventListener("keydown", enterEvent)
    // */
}

init()
