package util

import (
	"fmt"
	"math/rand"
	"time"
)

var CssLocation string

func GetCssLocation() string {
	if CssLocation == "" {
		CssLocation = "/assets/style." + randomString(5) + ".css"
	}
	return CssLocation
}

func randomString(length int) string {
	rand.Seed(time.Now().UnixNano())
	b := make([]byte, length)
	rand.Read(b)
	return fmt.Sprintf("%x", b)[:length]
}
