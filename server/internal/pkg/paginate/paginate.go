package paginate

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Params struct {
	Page     int
	PageSize int
}

func FromQuery(c *gin.Context) Params {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if page < 1 {
		page = 1
	}
	size, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if size < 1 {
		size = 20
	}
	if size > 200 {
		size = 200
	}
	return Params{Page: page, PageSize: size}
}

func (p Params) Apply(db *gorm.DB) *gorm.DB {
	return db.Offset((p.Page - 1) * p.PageSize).Limit(p.PageSize)
}
