import { getFoodList } from './../../../api/foodService';
import { showError, toFloat } from './../../../utils/tool';
const app = getApp();

Page({
    data: {
        statusBarHeight: app.globalData.toolBarHeight,
        storeInfo: app.globalData.storeInfo,
        addressInfo: app.globalData.addressInfo,
        serviceType: app.globalData.serviceType,

        // 全局数据
        menuArr: [],
        cartList: wx.getStorageSync('cart') || [],
        totalPrice: 0,
        totalNum: 0,

        // 当前选择
        currentDish: {}, // 一个主菜
        currentMandatory: wx.getStorageSync('mandatory') || {
            种类: "面",
            辣度: "微辣",
            麻度: "微麻",
            份量: "标准"
        }, // 必选
        currentOptional: [], // 多选
        currentEatType: '堂食',
        small_dish_list: [], // 小菜

        // 分类滚动
        leftActiveNum: 0,
        Tab: 0,
        heightArr: [], // 存储右侧每个条目的高度

        // 购物车动画
        animationData: {},
        animationMask: {},
        maskVisual: "hidden",
        maskFlag: true,

        // 选规格动画
        animationData2: {},
        animationMask2: {},
        maskVisual2: "hidden",
        maskFlag2: true,
    },
    onShow() {
        // 刷新购物车和用户选择的信息
        this.getCartList()
        this.setData({
            serviceType: app.globalData.serviceType,
            addressInfo: app.globalData.addressInfo
        })
    },
    onLoad() {
        this.getFoodList()
        app.on('storeInfoUpdated', this.updateInfo);
    },
    onUnload() {
        app.off('storeInfoUpdated', this.updateStoreInfo);
    },
    updateInfo() {
        this.setData({
            storeInfo: app.globalData.storeInfo,
        });
        this.confirmStatus()
        this.getFoodList()
    },
    onShareAppMessage: function () {
        wx.setStorageSync('haveInvite', true);
        return {
            title: '唐合丰面馆，一家独特的重庆拌面馆，快来尝尝吧！',
            path: '/pages/Home/home/home?referrer=' + this.data.userInfo.user_id
        };
    },


    // 1.菜品和购物车数据
    getCartList() {
        var cartList = wx.getStorageSync('cart') || [];
        var totalP = 0;
        var totalN = 0

        cartList = cartList.filter(item => item.quantity > 0);
        for (var i in cartList) { // 循环列表得到每个数据
            totalP += cartList[i].quantity * cartList[i].price;
            totalN += cartList[i].quantity
        }
        totalP = toFloat(totalP, 2)
        this.setData({
            cartList: cartList,
            totalNum: totalN,
            totalPrice: totalP
        });
        console.log('当前购物车', cartList)
        wx.setStorageSync('cart', cartList);
    },
    getFoodList() {
        getFoodList(1, this.data.serviceType, '上架').then(({ dishes, existingDishIds }) => {
            console.log("菜品数据：", dishes);
            console.log("菜品数据2：", existingDishIds);
            console.log("菜品数据3：", dishes[dishes.length - 1].list);
            this.setData({
                menuArr: dishes,
                small_dish_list: dishes[dishes.length - 1].list
            })
            this.cleanUpCart(existingDishIds);  // 删除没有的菜品
            this.updateDishQuantities(dishes);  // 更新购物车
            this.getHeightArr();                // 更新高度数组
        }).catch(error => {
            showError("获取菜品失败", error);
        });
    },
    cleanUpCart(existingDishIds) {
        let cartList = wx.getStorageSync('cart') || [];
        cartList = cartList.filter(item => existingDishIds.has(item.dish_id));
        wx.setStorageSync('cart', cartList);
        this.getCartList();
    },
    updateDishQuantities() {
        let cartList = wx.getStorageSync('cart') || [];
        let dishList = this.data.menuArr
        dishList.forEach(category => {
            category.list.forEach(dish => {
                dish.quantity = 0;
                let cartItem = cartList.find(cart => cart.dish_id === dish.dish_id && cart.note === "");
                if (cartItem) {
                    dish.quantity = cartItem.quantity;
                }
            })
        })
        this.setData({
            menuArr: dishList
        })
    },



    // 2.门店服务
    // changeStores() {
    //     wx.navigateTo({
    //         url: '/pages/Home/store/store',
    //     })
    // },
    onServiceTypeChange() {
        if (this.data.serviceType == '到店') {
            app.globalData.serviceType = '外卖'
            this.setData({
                serviceType: '外卖',
                currentEatType: '打包'
            });
            wx.navigateTo({
                url: '/pages/Home/address/address'
            })
        } else {
            app.globalData.serviceType = '到店'
            this.setData({
                serviceType: '到店'
            });
        }
        this.confirmStatus()
        this.getFoodList()
    },
    confirmStatus() {
        const serviceType = app.globalData.serviceType
        const business_status = app.globalData.storeInfo.business_status
        const takeout_status = app.globalData.storeInfo.takeout_status
        if (serviceType == '到店' && business_status !== '营业中') {
            wx.showModal({
                title: '提示',
                content: '本店暂未营业，请确认后再下单',
                showCancel: false,
                confirmText: '确定',
            });
            return false;
        }
        if (serviceType == '外卖' && takeout_status !== '可配送') {
            wx.showModal({
                title: '提示',
                content: '外卖暂不配送，请确认后再下单',
                showCancel: false,
                confirmText: '确定',
            });
            return false;
        }
        return true;
    },


    // 3.购物车操作
    minusCount(e) {
        let index = e.currentTarget.dataset.index;
        let cartList = wx.getStorageSync('cart') || [];

        // 减少数量
        if (cartList[index].quantity > 1) {
            cartList[index].quantity -= 1;
        } else {
            cartList[index].quantity = 0;
            cartList.splice(index, 1);
        }

        // 数据存储
        wx.setStorageSync('cart', cartList)
        this.setData({
            cartList: cartList,
        })
        this.getCartList()
        this.updateDishQuantities()

        if (cartList.length <= 0) {
            this.cascadeDismiss()
        }
    },
    addCount(e) {
        let index = e.currentTarget.dataset.index;
        let cartList = wx.getStorageSync('cart') || [];
        cartList[index].quantity += 1;

        // 数据存储
        wx.setStorageSync('cart', cartList)
        this.setData({
            cartList: cartList,
        })
        this.getCartList()
        this.updateDishQuantities()
    },
    deleteOne(e) {
        var index = e.currentTarget.dataset.index;
        var cart = wx.getStorageSync('cart')
        cart.splice(index, 1);
        wx.setStorageSync('cart', cart)
        this.setData({
            cartList: cart,
        })
        this.getCartList()
        this.updateDishQuantities()

        if (cart.length <= 0) {
            this.cascadeDismiss()
        }
    },
    cleanList() {
        wx.setStorageSync('cart', "")
        this.setData({
            cartList: [],
            totalNum: 0,
            totalPrice: 0,
        })
        this.updateDishQuantities()
        this.cascadeDismiss()
    },


    // 4.菜品详情页操作
    onEatTypeChange(e) {
        this.setData({
            currentEatType: e.currentTarget.dataset.option
        });
    },
    onMandatoryOptionChange(e) {
        let name = e.currentTarget.dataset.name;
        let value = e.currentTarget.dataset.option;
        let currentMandatory = this.data.currentMandatory;
        currentMandatory[name] = value;
        this.setData({
            currentMandatory: currentMandatory
        });
    },
    onOptionalOptionChange(e) {
        let values = e.detail.value;
        this.setData({
            currentOptional: values
        });
    },
    small_dish_minus(e) {
        let target = e.currentTarget.dataset.item;
        let menuList = this.data.small_dish_list
        menuList.forEach(item => {
            if (item.dish_id == target.dish_id) {
                item.quantity = item.quantity > 0 ? item.quantity - 1 : 0
            }
        })
        this.setData({
            small_dish_list: menuList
        })
    },
    small_dish_add(e) {
        let target = e.currentTarget.dataset.item;
        let menuList = this.data.small_dish_list
        menuList.forEach(item => {
            if (item.dish_id == target.dish_id) {
                item.quantity = item.quantity + 1;
            }
        })
        this.setData({
            small_dish_list: menuList
        })
    },
    addToCart() {
        this.addMainDish()
        this.addSmallDish()
        this.goDetailDismiss()
        wx.showToast({
            title: '加购成功！',
        })
        this.getCartList();
    },
    addMainDish() {
        let currentDish = this.data.currentDish;
        let currentMandatory = this.data.currentMandatory;
        let currentOptional = this.data.currentOptional;
        let currentEatType = this.data.currentEatType;
        let values = Object.values(this.data.currentMandatory);
        if (Object.keys(currentMandatory).length != 0) {
            wx.setStorageSync('mandatory', currentMandatory);
        }

        // 准备数据
        let item = {};
        item.dish_id = currentDish.dish_id;
        item.dish_name = currentDish.dish_name;
        item.price = currentDish.price;
        item.quantity = currentDish.quantity;
        item.eat_type = currentEatType;
        item.mandatory_options = currentMandatory;
        item.mandatory_values = values;
        item.optional_options = currentOptional;
        item.note = "";
        // 加量面加钱逻辑
        if (item.mandatory_options['份量'] == "加加量") {
            item.price = (parseFloat(item.price) + 1).toFixed(2);
        }

        let arr = wx.getStorageSync('cart') || [];
        let f = false;

        // 更新购物车中菜品数量
        if (arr.length > 0) {
            for (let j in arr) {
                if (arr[j].dish_id === item.dish_id &&
                    arr[j].eat_type == item.eat_type &&
                    JSON.stringify(arr[j].mandatory_options) === JSON.stringify(item.mandatory_options) &&
                    JSON.stringify(arr[j].optional_options) === JSON.stringify(item.optional_options)) {
                    arr[j].quantity += 1;
                    f = true;
                    break;
                }
            }
            if (!f) {
                item.quantity = 1;
                arr.push(item);
            }
        } else {
            item.quantity = 1;
            arr.push(item);
        }

        // 保存数据
        wx.setStorageSync('cart', arr)
        this.setData({
            cartList: arr,
        })
    },
    addSmallDish() {
        let smallDishes = this.data.small_dish_list;
        let smallCart = this.data.cartList;

        smallDishes.forEach(dish => {
            if (dish.quantity > 0) {
                let item = {};
                item.dish_id = dish.dish_id;
                item.dish_name = dish.dish_name;
                item.price = dish.price;
                item.quantity = dish.quantity;
                item.eat_type = '堂食';
                item.note = '放在' + this.data.currentDish.dish_name + '中'
                item.quantity = 1;
                smallCart.push(item);
            }
        })

        wx.setStorageSync('cart', smallCart)
        this.setData({
            cartList: smallCart
        })
    },



    // 5.确认结算
    gotoOrder() {
        var arr = wx.getStorageSync('cart') || [];
        // 确保有菜品
        if (!arr || arr.length == 0) {
            wx.showModal({
                title: '提示',
                content: '请选择菜品',
                showCancel: false, // 隐藏取消按钮
            })
            return;
        }
        // 确保在营业
        if (!this.confirmStatus())
            return;
        // 确保有地址
        if (this.data.serviceType === '外卖' && !this.data.addressInfo.phone) {
            wx.showModal({
                title: '提示',
                content: '请选择配送地址',
                success(res) {
                    if (res.confirm) {
                        wx.navigateTo({
                            url: '/pages/Home/address/address',
                        })
                    } else if (res.cancel) {
                        return;
                    }
                }
            });
            return;
        }

        wx.navigateTo({
            url: '/pages/Food/pay/pay'
        })
    },



    // 6.主界面操作
    // 6.1 菜品数量增加
    minusMenuCount(e) {
        let dishItem = e.currentTarget.dataset.item
        let cartList = wx.getStorageSync('cart') || [];

        // 更新购物车中菜品数量
        if (cartList.length > 0) {
            for (let j in cartList) {
                if (cartList[j].dish_id === dishItem.dish_id && cartList[j].note === "") {
                    cartList[j].quantity = cartList[j].quantity - 1 > 0 ? cartList[j].quantity - 1 : 0;
                    break;
                }
            }
        }

        // 保存数据
        wx.setStorageSync('cart', cartList)
        this.setData({
            cartList: cartList,
        })
        this.getCartList()
        this.updateDishQuantities()
    },
    addMenuCount(e) {
        let dishItem = e.currentTarget.dataset.item
        let item = {};
        item.dish_id = dishItem.dish_id;
        item.dish_name = dishItem.dish_name;
        item.price = dishItem.price;
        item.quantity = dishItem.quantity;
        item.eat_type = '堂食';
        item.note = "";

        let cartList = wx.getStorageSync('cart') || [];
        let f = false;

        // 更新购物车中菜品数量
        if (cartList.length > 0) {
            for (let j in cartList) {
                if (cartList[j].dish_id === item.dish_id && cartList[j].note === "") {
                    cartList[j].quantity += 1;
                    f = true;
                    break;
                }
            }
            if (!f) {
                item.quantity = 1;
                cartList.push(item);
            }
        } else {
            item.quantity = 1;
            cartList.push(item);
        }

        // 保存数据
        wx.setStorageSync('cart', cartList)
        this.setData({
            cartList: cartList,
        })
        this.getCartList()
        this.updateDishQuantities()
    },

    // 6.2 界面滚动
    getHeightArr() {
        let _this = this;
        // 通过高度与scrollTop的对比来获取目前滑动到哪个区域
        let heightArr = [];
        let h = 0;
        //创建节点选择器
        const query = wx.createSelectorQuery();
        //选择id
        query.selectAll('.rightblock').boundingClientRect()
        query.selectViewport().scrollOffset()
        query.exec(function (res) {
            //res就是 所有标签为contlist的元素的信息 的数组
            res[0].forEach((item) => {
                //这里的高度是每个栏目块到顶部的距离
                h += item.height;
                heightArr.push(h);
            })
            _this.setData({
                heightArr: heightArr
            })
        })
    },
    leftClickFn(e) {
        console.log(e)
        this.setData({
            leftActiveNum: e.currentTarget.dataset.myid,
            Tab: e.currentTarget.dataset.myid
        })
    },
    rightScrollFn(e) {
        let wucha = 15 // 避免机型有问题，给出一个误差范围
        let st = e.detail.scrollTop;
        let myArr = this.data.heightArr;

        for (let i = 0; i < myArr.length; i++) {
            //找出是滚动到了第一个栏目，然后设置栏目选中状态
            if (st >= myArr[i] && st < myArr[i + 1] - wucha) {
                console.log("找到的i", i)
                this.setData({
                    leftActiveNum: i + 1
                });
                return;
            } else if (st < myArr[0] - wucha) {
                this.setData({
                    leftActiveNum: 0
                });
            }
        }
    },

    // 6.3 详情页
    goDetailToggle(e) {
        let that = this;
        let dish = this.data.dataList
        if (that.data.maskVisual2 == "hidden") {
            let current = e.currentTarget.dataset.item
            let small_dish = this.data.small_dish_list
            small_dish.forEach(item => {
                item.quantity = 0
            })
            that.setData({
                currentDish: current,
                currentOptional: current.optional_options,
                small_dish_list: small_dish
            })
            if (current.mandatory_options.length == 0) {
                that.setData({
                    currentMandatory: {},
                })
            } else {
                that.setData({
                    currentMandatory: wx.getStorageSync('mandatory') || {
                        种类: "面",
                        辣度: "微辣",
                        麻度: "微麻",
                        份量: "标准"
                    },
                })
            }
            console.log('当前菜品', current)
            that.goDetailPopup()
        } else {
            this.updateDishQuantities(dish)
            that.goDetailDismiss()
        }

    },
    goDetailPopup() {
        var that = this;
        // 购物车打开动画
        var animation = wx.createAnimation({
            duration: 200,
            timingFunction: 'ease-in-out',
            delay: 0
        });
        that.animation = animation;
        animation.translate(0, -675).step();
        that.setData({
            animationData2: that.animation.export(),
        });
        // 遮罩渐变动画
        var animationMask2 = wx.createAnimation({
            duration: 200,
            timingFunction: 'linear',
        });
        that.animationMask2 = animationMask2;
        animationMask2.opacity(0.8).step();
        that.setData({
            animationMask2: that.animationMask2.export(),
            maskVisual2: "show",
            maskFlag2: false,
        });
    },
    goDetailDismiss() {
        var that = this
        // 购物车关闭动画
        that.animation.translate(0, 285).step();
        that.setData({
            animationData2: that.animation.export()
        });
        // 遮罩渐变动画
        that.animationMask2.opacity(0).step();
        that.setData({
            animationMask2: that.animationMask2.export(),
        });
        // 隐藏遮罩层
        that.setData({
            maskVisual2: "hidden",
            maskFlag2: true,
            currentDish: {}
        });
    },

    // 6.4 购物车
    cascadeToggle() {
        var that = this;
        var arr = this.data.cartList
        if (arr.length > 0) {
            if (that.data.maskVisual == "hidden") {
                that.cascadePopup()
            } else {
                that.cascadeDismiss()
            }
        } else {
            that.cascadeDismiss()
        }
    },
    cascadePopup() {
        var that = this;
        // 购物车打开动画
        var animation = wx.createAnimation({
            duration: 200,
            timingFunction: 'ease-in-out',
            delay: 0
        });
        that.animation = animation;
        animation.translate(0, -385).step();
        that.setData({
            animationData: that.animation.export(),
        });
        // 遮罩渐变动画
        var animationMask = wx.createAnimation({
            duration: 200,
            timingFunction: 'linear',
        });
        that.animationMask = animationMask;
        animationMask.opacity(0.8).step();
        that.setData({
            animationMask: that.animationMask.export(),
            maskVisual: "show",
            maskFlag: false,
        });
    },
    cascadeDismiss() {
        var that = this
        // 购物车关闭动画
        that.animation.translate(0, 285).step();
        that.setData({
            animationData: that.animation.export()
        });
        // 遮罩渐变动画
        that.animationMask.opacity(0).step();
        that.setData({
            animationMask: that.animationMask.export(),
        });
        // 隐藏遮罩层
        that.setData({
            maskVisual: "hidden",
            maskFlag: true
        });
    },
})