import * as THREE from "three"
import { w3cwebsocket } from "websocket";
import { Basemap } from "./basemap";
import BasemapRoadItem from "./basemap/roadItem";
import { BuildingManager } from "./building/manager";
import BasemapBuildingItem from "./basemap/buildingItem";
import { SynchronizationData, MessageData, RoadData, BuildingData } from "./def";

class Var {
    static id: number = 0
    public ID = Var.id++
    constructor(public done: boolean = false) { }
}
let last = new Var(true)

const basemap = new Basemap<{}, {}>()
const manager = new BuildingManager()


class WebSocket {
    public readonly socket: w3cwebsocket
    readonly host: string
    readonly port: number

    constructor(host: string, port: number) {
        this.host = host
        this.port = port

        const conn = `ws://${this.host}:${this.port}/`

        this.socket = new w3cwebsocket(conn)

        this.socket.onopen = () => {
            console.log("[Socket] connection established.")
            this.socket.send(new MessageData("__ts_client").toString())
        }


        this.socket.onmessage = (msg) => {
            const msgData = JSON.parse(msg.data)
            console.log(`[Socket] receive ${msg.data}.`)
            const { type, data } = msgData
            if (type == "Message" && data.info == "Data required") {
                const modelData = basemap.export()
                this.socket.send(JSON.stringify({
                    type: "Message",
                    data: {
                        info: "Room data",
                        roads: modelData.roads,
                        buildings: modelData.buildings
                    }
                }, null, 4))
            }

            if (type == "Synchronization data") {
                const lastVar = last
                const selfVar = new Var()
                last = selfVar

                const triggerMainLoop = () => {
                    if (!lastVar.done) setTimeout(triggerMainLoop, 0)
                    else {
                        console.log(`[Socket] begin to check data validation.`)
                        const resolve = (): Promise<boolean> => {
                            return new Promise((resolve, reject) => {
                                let { state, roads, buildings } = data
                                if (roads.length != 0) {
                                    const { from, to, width } = roads[0]
                                    const fromVec = new THREE.Vector2(from.x, from.y)
                                    const toVec = new THREE.Vector2(to.x, to.y)
                                    let valid: boolean = false
                                    if (state == "insert") {
                                        const roadItem: BasemapRoadItem<{}> = new BasemapRoadItem<{}>(width, fromVec, toVec)
                                        valid = basemap.alignRoad(roadItem)
                                        if (valid) basemap.addRoad(width, fromVec, toVec)
                                    }
                                    else if (state == "remove") {
                                        const center = fromVec.clone().add(toVec).divideScalar(2)
                                        const roadItem = basemap.selectRoad(center)
                                        if (roadItem) {
                                            basemap.removeRoad(roadItem)
                                            valid = true
                                        }
                                    }
                                    // const valid = basemap.alignRoad(roadItem)
                                    // if (valid) basemap.addRoad(width, fromVec, toVec)
                                    resolve(valid)
                                }
                                else if (buildings.length != 0) {
                                    const { prototype, center } = buildings[0]
                                    const pos = new THREE.Vector2(center.x, center.y)
                                    const proto = manager.get(prototype)
                                    if (state == "insert") {
                                        const modelInfo = basemap.alignBuilding(pos.clone(), proto.placeholder)
                                        const { road, angle, valid, offset } = modelInfo
                                        console.log("[insert result]", road, angle, valid, offset)
                                        if (valid) basemap.addBuilding(new BasemapBuildingItem<{}>(proto, pos, angle, road, offset))
                                        resolve(valid)
                                    }
                                    else if (state == "remove") {
                                        const building = basemap.selectBuilding(pos, Math.max(proto.placeholder.x, proto.placeholder.y) * 5)
                                        if (building) {
                                            basemap.removeBuilding(building)
                                            resolve(true)
                                        }
                                        else resolve(false)
                                    }
                                    // if (valid) basemap.addBuilding(new BasemapBuildingItem(proto, center, angle, road, offset))
                                    // resolve(valid)
                                }
                            })
                        }
                        resolve().then((valid: boolean) => {
                            const DATA = {
                                type: "Message",
                                data: {
                                    info: "State check",
                                    valid: valid,
                                    roads: data.roads,
                                    buildings: data.buildings
                                }
                            }
                            this.socket.send(JSON.stringify(DATA, null, 4))
                            console.log(`[Socket] finish data validation check, state:${valid}.`)
                            selfVar.done = true
                        })
                    }
                }
                triggerMainLoop()
            }
        }

        this.socket.onclose = () => {
            console.log("[Socket] connection closed.")
        }
    }
}

manager.load([
    "export/Building_Auto Service",
    "export/Building_Bakery",
    "export/Building_Bar",
    "export/Building_Books Shop",
    "export/Building_Chicken Shop",
    "export/Building_Clothing",
    "export/Building_Coffee Shop",
    "export/Building_Drug Store",
    "export/Building_Factory",
    "export/Building_Fast Food",
    "export/Building_Fruits  Shop",
    "export/Building_Gas Station",
    "export/Building_Gift Shop",
    "export/Building_House_01_color01",
    "export/Building_House_02_color01",
    "export/Building_House_03_color01",
    "export/Building_House_04_color01",
    "export/Building_Music Store",
    "export/Building_Pizza",
    "export/Building_Residential_color01",
    "export/Building_Restaurant",
    "export/Building_Shoes Shop",
    "export/Building Sky_big_color01",
    "export/Building Sky_small_color01",
    "export/Building_Stadium",
    "export/Building_Super Market"
]).then(() => {
    // const ws = new WebSocket("47.98.213.238", 8899)
    const ws = new WebSocket("localhost", 8899)
})
