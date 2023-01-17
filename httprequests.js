
export {HttpRequests}

const base_url = "http://localhost:8080/"

class HttpRequests {

    static async makeRequest(requestType, params, httpMethod) {
        /*
        requestType: api request, e.g. "add", "get-node", "link"
        params: dict of keys and values for request's params
        httpMethod: "GET", "POST", "PUT", etc
         */
        try {
            const urlParams = new URLSearchParams(params).toString()
            const fullUrl = base_url + requestType + "?" + urlParams
            const res = await fetch(fullUrl, {method: httpMethod})

            if (res.headers.get("Content-type") === "text/json") {
                return res.json()
            } else {
                return res.text()
            }
        } catch (e) {
            console.error(e.stackTrace)
            return false
        }
    }

    static async addNode(type, title, content="", parent=0) {
        /*
        type: "concept", "explanation", "comment", etc
        title: title to be given to new node
        content: content to be given to new node
        parent: parent new node should start with

        return: id of new node
         */
        const params = {type: type, title: title, content: content, parent: parent}
        return this.makeRequest("add", params, "POST")
    }

    static async deleteNode(id) {
        /*
        id: id of node to delete
         */
        const params = {id: id}
        return this.makeRequest("delete", params, "DELETE")
    }

    static async updateNode(id,attr,val) {
        /*
        id: id of node to update
        attr: name of attribute to update. "title", "content", or "type"
        val: new value of attribute
         */
        const params = {id: id, attr: attr, val: val}
        return this.makeRequest("update", params, "PATCH")
    }

    static async linkNode(parent,child,twoWay=false) {
        /*
        parent: id of source node
        child: id of target node
        twoWay: whether the link's direction should go both ways
         */
        const params = {parent:parent, child:child, "two-way": twoWay}
        return this.makeRequest("link", params, "POST")
    }

    static async unlinkNode(parent,child,twoWay=false) {
        /*
        parent: id of source node
        child: id of target node
        twoWay: whether the link's direction should go both ways
         */
        const params = {parent:parent, child:child, "two-way": twoWay}
        return this.makeRequest("unlink", params, "DELETE")
    }

    static async getNode(id) {
        /*
        id: id of node to get
         */
        const params = {id: id}
        return this.makeRequest("get-node", params, "GET")
    }

    static async getGraph() {
        return this.makeRequest("get-graph", {}, "GET")
    }

    static async listNodeIds() {
        return this.makeRequest("get-all-node-ids", {}, "GET")
    }
}
